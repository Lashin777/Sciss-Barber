
const notFoundMiddleware = (req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API route not found'
        });
    }

    const isAdminPage = req.path === '/admin' || req.path.startsWith('/admin/');
    return res.status(404).render('errors/404', { isAdminPage });
};

export default notFoundMiddleware;
