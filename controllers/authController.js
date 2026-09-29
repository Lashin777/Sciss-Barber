import UsersignUp from '../services/authService.js';

const signup = async (req, res) => {
    try {
        const newUser = await UsersignUp(req.body.email, req.body.name, req.body.password)
        res.status(201).json({
            message: "signUp succesful",
            userId: newUser._id
        });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}
export default signup