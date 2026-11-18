const errorMiddleware = (err, req, res, next) => {
    console.error(err.stack);

    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    if (req.originalUrl.startsWith('/api/')) {
        return res.status(statusCode).json({
            success: false,
            message: isProduction
                ? 'Internal Server Error'
                : err.message || 'Internal Server Error'
        });
    }

    return res.status(statusCode).render('errors/500');
};

export default errorMiddleware;