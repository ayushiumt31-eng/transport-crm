const expenseService = require('../../services/billing/expense.service');

const handle = (work) => async (request, response, next) => {
    try {
        return response.json({ success: true, data: await work(request) });
    } catch (error) {
        return next(error);
    }
};

exports.listExpenses = handle((request) => expenseService.listExpenses(request.validated.query));
exports.getSummary = handle((request) => expenseService.getExpenseSummary(request.validated.query));
exports.createExpense = async (request, response, next) => {
    try {
        const result = await expenseService.createExpense(request.body, request.user);
        return response.status(result.created ? 201 : 200).json({
            success: true,
            message: result.created ? 'Expense recorded.' : 'Expense was already recorded.',
            data: result.expense
        });
    } catch (error) {
        return next(error);
    }
};
