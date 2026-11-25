import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


const verifyEmailConnection = async()=>{
    return await transporter.verify();
}

const sendEmail = async ({ to, subject, text, html }) => {
    return await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
        html
    });
};


const escapeHtml = (value) => {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
};

const sendBookingNotification = async (booking, emailSender = sendEmail) => {

    if (
    !booking?.adminEmail ||
    !booking?.appointmentStart ||
    !booking?.appointmentEnd ||
    !Number.isFinite(new Date(booking.appointmentStart).getTime()) ||
    !Number.isFinite(new Date(booking.appointmentEnd).getTime()) ||
    !Number.isFinite(booking.advanceAmount)
) {
    throw new Error("Invalid booking notification data");
}
    const appointmentDate = booking.appointmentStart.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const startTime = booking.appointmentStart.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit'
    });

    const endTime = booking.appointmentEnd.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit'
    });

    const advanceAmount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(booking.advanceAmount);

    const customerName = escapeHtml(booking.customerName);
    const serviceName = escapeHtml(booking.serviceName);
    const barberName = escapeHtml(booking.barberName);
    const status = escapeHtml(booking.status);

    const text = `
New Booking Received - SCISS BARBER

Customer: ${booking.customerName}
Service: ${booking.serviceName}
Barber: ${booking.barberName}
Date: ${appointmentDate}
Time: ${startTime} - ${endTime}
Advance: ${advanceAmount}
Status: ${booking.status}
`;

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:30px 15px;background:#f4f4f4;font-family:Arial,sans-serif;color:#222;">

    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;">

        <div style="background:#080808;padding:28px;text-align:center;">
            <h1 style="margin:0;color:#00D06C;letter-spacing:3px;font-size:26px;">
                SCISS BARBER
            </h1>
            <p style="margin:8px 0 0;color:#ffffff;font-size:13px;">
                PREMIUM GROOMING EXPERIENCE
            </p>
        </div>

        <div style="padding:30px;">

            <h2 style="margin-top:0;color:#111;">
                New Booking Received!
            </h2>

            <p style="color:#666;font-size:14px;line-height:1.6;">
                A new appointment has been submitted. Here are the booking details.
            </p>

            <table style="width:100%;border-collapse:collapse;margin-top:25px;font-size:14px;">

                <tr>
                    <td style="padding:13px;border-bottom:1px solid #eee;color:#777;">Customer</td>
                    <td style="padding:13px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${customerName}</td>
                </tr>

                <tr>
                    <td style="padding:13px;border-bottom:1px solid #eee;color:#777;">Service</td>
                    <td style="padding:13px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${serviceName}</td>
                </tr>

                <tr>
                    <td style="padding:13px;border-bottom:1px solid #eee;color:#777;">Barber</td>
                    <td style="padding:13px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${barberName}</td>
                </tr>

                <tr>
                    <td style="padding:13px;border-bottom:1px solid #eee;color:#777;">Date</td>
                    <td style="padding:13px;border-bottom:1px solid #eee;text-align:right;">${appointmentDate}</td>
                </tr>

                <tr>
                    <td style="padding:13px;border-bottom:1px solid #eee;color:#777;">Time</td>
                    <td style="padding:13px;border-bottom:1px solid #eee;text-align:right;">${startTime} - ${endTime}</td>
                </tr>

                <tr>
                    <td style="padding:13px;border-bottom:1px solid #eee;color:#777;">Advance Payment</td>
                    <td style="padding:13px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#00a653;">${advanceAmount}</td>
                </tr>

            </table>

            <div style="margin-top:25px;padding:15px;background:#f0fff6;border-left:4px solid #00D06C;">
                <span style="color:#555;font-size:13px;">Booking Status</span>
                <p style="margin:6px 0 0;font-weight:bold;color:#111;">${status}</p>
            </div>

        </div>

        <div style="padding:18px;text-align:center;background:#080808;color:#aaa;font-size:12px;">
            © ${new Date().getFullYear()} SCISS BARBER. All rights reserved.
        </div>

    </div>

</body>
</html>
`;

    return await emailSender({
        to: booking.adminEmail,
        subject: 'New Booking Received - SCISS BARBER',
        text,
        html
    });
};

export { sendEmail ,sendBookingNotification,verifyEmailConnection};
