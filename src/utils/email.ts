import { render } from "@react-email/render";
import { createTransport } from "nodemailer";

export async function sendEmail({
  emailComponent,
  to,
  from,
  subject,
  attachments,
}: {
  emailComponent: JSX.Element;
  to: string;
  from: string;
  subject: string;
  attachments: {
    filename: string;
    path: string;
    cid: string;
  }[];
}) {
  const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    //   secure: true,
    auth: {
      // TODO: replace `user` and `pass` values from <https://forwardemail.net>
      user: process.env.EMAIL_SENDER,
      pass: process.env.EMAIL_PWD,
    },
  });

  const emailHtml = render(emailComponent);

  const info = await transporter.sendMail({
    from, // sender address
    to, // list of receivers
    subject, // Subject line
    html: emailHtml, // html body
    attachments,
  });

  return info;
}

export async function sendEmailMessage({
  message,
  to,
  from,
  subject,
  attachments,
}: {
  message: string;
  to: string;
  from: string;
  subject: string;
  attachments: {
    filename: string;
    path: string;
    cid: string;
  }[];
}) {
  const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    //   secure: true,
    auth: {
      // TODO: replace `user` and `pass` values from <https://forwardemail.net>
      user: process.env.EMAIL_SENDER,
      pass: process.env.EMAIL_PWD,
    },
  });

  const info = await transporter.sendMail({
    from, // sender address
    to, // list of receivers
    subject, // Subject line
    text: message, // html body
    attachments,
  });

  return info;
}
