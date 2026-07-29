function computeMonthsBehind(purchaseDate, monthlyInstallment, totalPaid, terms) {
    if (!purchaseDate || monthlyInstallment <= 0 || terms <= 0) return 0;

    const now = new Date();
    const purchase = new Date(purchaseDate + 'T12:00:00');
    const monthsSince = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());

    if (monthsSince < 1) return 0;

    const expected = monthsSince;
    const actual = Math.floor(totalPaid / monthlyInstallment);

    return Math.max(0, expected - actual);
}

module.exports = { computeMonthsBehind };
