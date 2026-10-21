const USER_SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

// Worked by Codex: keep cookie issuance and clearing options in sync.
const sessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
};

const setUserSessionCookie = (res, token) => {
    res.cookie('token', token, {
        ...sessionCookieOptions,
        maxAge: USER_SESSION_MAX_AGE
    });
};

const clearUserSessionCookie = (res) => {
    res.clearCookie('token', sessionCookieOptions);
};

// Worked by Codex: keep admin authentication isolated from customer sessions.
const setAdminSessionCookie = (res, token) => {
    res.cookie('admin_token', token, {
        ...sessionCookieOptions,
        maxAge: USER_SESSION_MAX_AGE
    });
};

const clearAdminSessionCookie = (res) => {
    res.clearCookie('admin_token', sessionCookieOptions);
};

export {
    setUserSessionCookie,
    clearUserSessionCookie,
    setAdminSessionCookie,
    clearAdminSessionCookie
};
