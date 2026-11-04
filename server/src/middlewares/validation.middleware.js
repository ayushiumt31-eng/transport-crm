function validate(schema, source = 'body') {
    return (request, response, next) => {
        const { error, value } = schema.validate(request[source], {
            abortEarly: false,
            convert: true,
            allowUnknown: false
        });

        if (error) {
            return response.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.details.map((detail) => ({
                    message: detail.message,
                    path: detail.path.join('.')
                }))
            });
        }

        if (source === 'body') {
            request.body = value;
        } else {
            request.validated = { ...request.validated, [source]: value };
        }
        return next();
    };
}

module.exports = { validate };
