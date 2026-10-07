import { adminLogin, blockUser, UnblockUser, getAllUser } from '../services/adminService.js';

const adminLoginController = async (req, res) => {
    try {
        const result = await adminLogin(req.body.email, req.body.password);
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}
const adminBlockController = async (req, res) => {
    try {
        const block = await blockUser(req.params.id);
        res.status(200).json({ message: "the User Have Been block " })
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const adminUnblockController = async (req, res) => {
    try {
        const Unblock = await UnblockUser(req.params.id);
        res.status(200).json({ message: "the User Have Been Unblock " })
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const getAllUserController = async (req, res) => {
    try {
        const getUser = await getAllUser(req.query.search, req.query.page, req.query.list);
        res.status(200).json({ message: getUser });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

export { adminLoginController, adminBlockController, adminUnblockController, getAllUserController }