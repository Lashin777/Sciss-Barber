

const validationSignup = async (req, res, next) => {
    const { name, email, phone, password } = req.body
    //requied feild 
    if (typeof name !== 'string' || !name.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof phone !== 'string' || !phone ||
        typeof password !== 'string' || !password.trim()
    ) {
        return res.status(400).json({
            message: "All Fields Are Requied"
        })
    }

    //name feild

    const namePattern = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

    if (!namePattern.test(name.trim())) {
        return res.status(400).json({
            message: "Please Enter Valid Name "
        })
    }

    //email feild
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email.trim())) {
        return res.status(400).json({
            message: "Please Enter Valid Email Address"
        })
    }

    //phone feild

    const phonePattern = /^[0-9]{10}$/

    if (!phonePattern.test(phone.trim())) {
        return res.status(400).json({
            message: "Please Enter a Valid 10-Digit Phone Number"
        })
    }

    //PASSWORD FEILD
    if (password.length < 6) {
        return res.status(400).json({
            message: "Password Must Be At Least 6 Characters Long"
        })
    }
    next()
}

const validationLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
        return res.status(400).json({
            message: 'Email and password are required'
        });
    }

    //EMAIL FEILD 
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
        return res.status(400).json({
            message: 'Please enter a valid email address'
        });
    }

    next();
};

const validationProfileUpdate = (req, res, next) => {
    let name;
    let phone;

    if (typeof req.body.name === 'string') {
        name = req.body.name.trim();
    }

    if (typeof req.body.phone === 'string') {
        phone = req.body.phone.trim();
    }

    // Name validation
    const namePattern = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
    if (name !== undefined) {
        if (name.length < 2 || name.length > 80) {
            return res.status(400).json({
                message: 'Name must be between 2 and 80 characters'
            });
        }
    }

    if (name !== undefined && !namePattern.test(name)) {
        return res.status(400).json({
            message: "please enter a valid name "
        });
    }


    // Phone validation
    if (phone !== undefined && phone !== '') {
        if (!/^\+?[0-9() .-]{7,20}$/.test(phone)) {
            return res.status(400).json({
                message: 'Enter a valid phone number'
            });
        }
    }
    // Check whether any changes were provided
    if (
        (name === undefined || name === '') && (phone === undefined || phone === '') && !req.file) {
        return res.status(400).json({
            message: 'No profile changes provided'
        });
    }

    next();
};

const validationPasswordChange = (req, res, next) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({ message: 'Enter your current password' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New passwords do not match' });
    }

    next();
};


const validationResetPassword = (req, res, next) => {
    const { email, otp, password } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
    }

    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ message: 'Enter a valid 6-digit OTP' });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    next();
};

const validationEmailChangeRequest = (req, res, next) => {
    const { email } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
        return res.status(400).json({ message: 'Enter a valid email address' });
    }

    next();
};

const validationEmailChangeVerify = (req, res, next) => {
    const { email, otp } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
        return res.status(400).json({ message: 'Enter a valid email address' });
    }

    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ message: 'Enter a valid 6-digit OTP' });
    }

    next();
};


const validationPaymentOrder = (req, res, next) => {
    const { bookingId, serviceId } = req.body;

    const isValidObjectId = (id) =>
        typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    if (!isValidObjectId(bookingId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid booking ID'
        });
    }

    if (!isValidObjectId(serviceId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid service ID'
        });
    }

    next();
};
const validationMongoId = (req, res, next) => {
    const { id } = req.params;

    if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid user ID'
        });
    }

    next();
};

const validationAdminUserQuery = (req, res, next) => {
    const { search, page, list, date } = req.query;

    if (search !== undefined && typeof search !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Invalid search value'
        });
    }

    if (page !== undefined && (!/^[1-9]\d*$/.test(page))) {
        return res.status(400).json({
            success: false,
            message: 'Page must be a positive integer'
        });
    }

    if (list !== undefined && (!/^[1-9]\d*$/.test(list))) {
        return res.status(400).json({
            success: false,
            message: 'List must be a positive integer'
        });
    }

    if (date !== undefined) {
        const parsedDate = new Date(`${date}T00:00:00.000Z`);

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== date
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }
    }

    next();
};

export { validationSignup,
         validationLogin,
         validationProfileUpdate,
         validationPasswordChange,
         validationResetPassword,
         validationEmailChangeVerify,
         validationEmailChangeRequest,
         validationPaymentOrder,
         validationMongoId,
         validationAdminUserQuery
    }
