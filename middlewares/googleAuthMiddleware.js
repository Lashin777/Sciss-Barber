import passport from "passport";


const googleAuthMiddleWare = (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
        if (err) {
            return next(err)
        }

        if (!user) {
            if (info?.code === 'BLOCKED') {
                return res.redirect('/login?error=BLOCKED');
            }

            return res.redirect('/login?error=GOOGLE_FAILED')
        }

        req.user = user;
        next()
    })(req, res, next)
};

export default googleAuthMiddleWare