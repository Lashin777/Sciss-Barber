import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userModel.js";


passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });

                if (user) {

                    if (user.role !== 'CUSTOMER') {
                        return done(null, false)
                    }
                    if (user.status === 'BLOCKED') {
                        return done(null, false, { code: "BLOCKED" })
                    }
                    return done(null, user)

                }

                const email = profile.emails[0].value;
                user = await User.findOne({ email });

                if (user) {
                    if (user.role !== 'CUSTOMER') {
                        return done(null, false)
                    }
                    if (user.status === 'BLOCKED') {
                        return done(null, false, { code: 'BLOCKED' })
                    }
                    user.googleId = profile.id;
                    user.isEmailVerified = true;
                    await user.save();
                    return done(null, user)

                }

                user = await User.create({
                    name: profile.displayName,
                    email: email,
                    googleId: profile.id,
                    isEmailVerified: true,
                    profileImage: profile.photos[0].value
                })
                return done(null, user)
            } catch (error) {
                return done(error, null)
            }
        }
    )
)
