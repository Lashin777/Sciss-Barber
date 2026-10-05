import { adminLogin } from '../services/adminService.js';

const adminLoginController = async (req, res) => {
    try {
        const result = await adminLogin(req.body.email, req.body.password);
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

export { adminLoginController }