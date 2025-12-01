// Dummy quote lines
    @track quoteLines = [
        { id: 'QLI1', name: 'Quote Line 1', productName: 'Product A', quantity: 100 },
        { id: 'QLI2', name: 'Quote Line 2', productName: 'Product B', quantity: 50 },
        { id: 'QLI3', name: 'Quote Line 3', productName: 'Product C', quantity: 75 }
    ];

    // Dummy accounts (pretend these are child accounts)
    @track accounts = [
        { id: 'ACC1', name: 'Child Account 1' },
        { id: 'ACC2', name: 'Child Account 2' },
        { id: 'ACC3', name: 'Child Account 3' }
    ];

    /**
     * allocationsMap structure:
     * {
     *   QLI1: [
     *     { id: 'alloc_1', accountId: 'ACC1', quantity: 10 },
     *     { id: 'alloc_2', accountId: 'ACC2', quantity: 20 }
     *   ],
     *   QLI2: [
     *     { id: 'alloc_3', accountId: 'ACC3', quantity: 5 }
     *   ]
     * }
     */
    @track allocationsMap = {};

    /** --------- BASIC GETTERS --------- */

    get hasData() {
        return this.quoteLines && this.quoteLines.length > 0;
    }

    get hasNoData() {
        return !this.hasData;
    }

    // Combobox options for accounts
    get accountOptions() {
        return this.accounts.map((acc) => ({
            label: acc.name,
            value: acc.id
        }));
    }

    /**
     * Build a nice view model for the template
     */
    get quoteLinesView() {
        return this.quoteLines.map((qli) => {
            const allocations = this.allocationsMap[qli.id] || [];
            const totalAllocated = allocations.reduce(
                (sum, a) => sum + (parseFloat(a.quantity) || 0),
                0
            );

            const hasAllocations = allocations.length > 0;
            const noAllocations = !hasAllocations;

            const isExactMatch =
                hasAllocations && totalAllocated === (qli.quantity || 0);

            const allocatedSummary = hasAllocations
                ? `Allocated: ${totalAllocated} / ${qli.quantity}`
                : 'Allocated: 0 / ' + qli.quantity;

            const allocBadgeClass = isExactMatch
                ? 'qas-alloc-badge qas-alloc-badge-ok'
                : hasAllocations
                ? 'qas-alloc-badge qas-alloc-badge-warning'
                : 'qas-alloc-badge qas-alloc-badge-empty';

            const showAllocWarning =
                hasAllocations && !isExactMatch;

            return {
                ...qli,
                allocations,
                hasAllocations,
                noAllocations,
                allocatedSummary,
                allocBadgeClass,
                showAllocWarning
            };
        });
    }

    /** --------- EVENT HANDLERS --------- */

    handleAddAccount(event) {
        const qliId = event.currentTarget.dataset.qliId;
        if (!qliId) return;

        const mapCopy = { ...this.allocationsMap };
        const existing = mapCopy[qliId] ? [...mapCopy[qliId]] : [];

        const newAlloc = {
            id: 'alloc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            accountId: null,
            quantity: null
        };

        existing.push(newAlloc);
        mapCopy[qliId] = existing;
        this.allocationsMap = mapCopy;
    }

    handleAccountChange(event) {
        const qliId = event.target.dataset.qliId;
        const allocId = event.target.dataset.allocId;
        const value = event.detail.value;
        if (!qliId || !allocId) return;

        this.updateAllocation(qliId, allocId, { accountId: value });
    }

    handleQuantityChange(event) {
        const qliId = event.target.dataset.qliId;
        const allocId = event.target.dataset.allocId;
        let value = event.target.value;

        if (!qliId || !allocId) return;

        if (value === '' || value === null) {
            value = 0;
        }

        let qty = parseFloat(value);
        if (isNaN(qty) || qty < 0) {
            qty = 0;
            event.target.value = 0;
        }

        this.updateAllocation(qliId, allocId, { quantity: qty });
    }

    updateAllocation(qliId, allocId, patch) {
        const mapCopy = { ...this.allocationsMap };
        const list = mapCopy[qliId] ? [...mapCopy[qliId]] : [];
        const index = list.findIndex((a) => a.id === allocId);
        if (index === -1) return;

        list[index] = { ...list[index], ...patch };
        mapCopy[qliId] = list;
        this.allocationsMap = mapCopy;
    }

    handleRemoveAllocation(event) {
        const qliId = event.currentTarget.dataset.qliId;
        const allocId = event.currentTarget.dataset.allocId;
        if (!qliId || !allocId) return;

        const mapCopy = { ...this.allocationsMap };
        const list = mapCopy[qliId] ? [...mapCopy[qliId]] : [];
        mapCopy[qliId] = list.filter((a) => a.id !== allocId);
        this.allocationsMap = mapCopy;
    }

    handleBaseQuantityChange(event) {
        const qliId = event.target.dataset.qliId;
        let value = event.target.value;
        if (!qliId) return;

        if (value === '' || value === null) {
            value = 0;
        }
        let newQty = parseFloat(value);
        if (isNaN(newQty) || newQty < 0) {
            newQty = 0;
            event.target.value = 0;
        }

        this.quoteLines = this.quoteLines.map((qli) =>
            qli.id === qliId ? { ...qli, quantity: newQty } : qli
        );
    }

    /** --------- SAVE + VALIDATION --------- */
    handleSave() {
        const errors = [];

        this.quoteLines.forEach((qli) => {
            const list = this.allocationsMap[qli.id] || [];
            const sum = list.reduce(
                (s, a) => s + (parseFloat(a.quantity) || 0),
                0
            );

            if (list.length > 0 && sum !== qli.quantity) {
                errors.push(
                    `${qli.productName}: allocated ${sum}, expected ${qli.quantity}`
                );
            }
        });

        if (errors.length > 0) {
            this.showToast(
                'Validation Error',
                'For each product, sum of child quantities must equal base quantity. ' +
                    errors.join(' | '),
                'error'
            );
            return;
        }

        // Build flat payload
        const payload = [];
        Object.keys(this.allocationsMap).forEach((qliId) => {
            (this.allocationsMap[qliId] || []).forEach((a) => {
                payload.push({
                    quoteLineItemId: qliId,
                    accountId: a.accountId,
                    quantity: a.quantity
                });
            });
        });

        // Dummy: log payload
        // eslint-disable-next-line no-console
        console.log('Final dummy payload:', JSON.stringify(payload, null, 2));

        this.showToast('Success', 'Allocations logged in console.', 'success');
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
