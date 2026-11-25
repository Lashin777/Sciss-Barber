

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

    if (name.trim().length < 2 || name.trim().length > 80) {
        return res.status(400).json({ message: 'Name must be between 2 and 80 characters' });
    }

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

    const phonePattern = /^[6-9][0-9]{9}$/


    if (!phonePattern.test(phone.trim())) {
        return res.status(400).json({
            message: "Please Enter a Valid 10-Digit Phone Number"
        })
    }

    if (/^(\d)\1{9}$/.test(phone.trim())) {
    return res.status(400).json({
            message: "Please Enter a Valid Phone Number"
        });
    }

    //PASSWORD FEILD
    if (password.length < 8) {
        return res.status(400).json({
            message: "Password Must Be At Least 8 Characters Long"
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


    // Worked by Codex: keep profile phone validation identical to signup's Indian mobile rule.
    if (phone !== undefined) {
        if (!/^[6-9]\d{9}$/.test(phone) || /^(\d)\1{9}$/.test(phone)) {
            return res.status(400).json({
                message: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9'
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ message: 'Enter a valid email address' });
    }

    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ message: 'Enter a valid 6-digit OTP' });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    next();
};

// Worked by Codex: validate an admin recovery email without requiring a password field.
const validationForgotPassword = (req, res, next) => {
    const { email } = req.body;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address' });
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
    const { bookingId, serviceId, serviceIds } = req.body;

    const isValidObjectId = (id) =>
        typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    if (!isValidObjectId(bookingId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid booking ID'
        });
    }

    const requestedIds = serviceIds === undefined ? [serviceId] : serviceIds;
    if (!Array.isArray(requestedIds) || requestedIds.length === 0 || requestedIds.some((id) => !isValidObjectId(id))) {
        return res.status(400).json({
            success: false,
            message: 'Choose one or more valid services'
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

// Worked by Codex: reject malformed booking IDs before they reach Mongoose queries.
const validationBookingId = (req, res, next) => {
    const { bookingId } = req.params;

    if (typeof bookingId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid booking ID'
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
         validationForgotPassword,
         validationEmailChangeVerify,
         validationEmailChangeRequest,
         validationPaymentOrder,
         validationBookingId,
         validationMongoId,
         validationAdminUserQuery
    }
