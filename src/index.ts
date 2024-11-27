import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import "dotenv/config";
import type { Address } from "nodemailer/lib/mailer";
import { parse } from "csv-parse/sync";
import fs from "node:fs/promises";
import path from "node:path";

const transporter = nodemailer.createTransport({
	host: "smtp.qiye.163.com",
	port: 465,
	secure: true,
	auth: {
		user: process.env.user,
		pass: process.env.pass,
	},
});

async function sendEmail(
	params: Pick<Mail.Options, "to" | "subject" | "html" | "text">,
) {
	const verify = await transporter.verify();
	console.log("verify", verify);

	if (verify) {
		readCSV("./csv/test.csv");
		if (!process.env.template_file) {
			console.log("template file not found");
			return;
		}
		const template = await readTemplate(process.env.template_file);
		await transporter.sendMail({
			from: process.env.user,
			to: params.to,
			replyTo: process.env.user,
			subject: params.subject,
			text: params.text,
			html: template.replace("{{name}}", (params.to as Address).name),
		});
	}
}

async function readCSV(relativePath: string): Promise<Array<{
	CompanyName: string;
	Person: string;
	Email: string;
	TelNo: string;
}>> {
	const content = await fs.readFile(path.resolve(process.cwd(), relativePath));
	const parser = await parse(content, {
		columns: ["CompanyName", "Person", "Email", "TelNo"],
		trim: true,
		skip_empty_lines: true,
	});
	return parser;
}

async function readTemplate(relativePath: string): Promise<string> {
	const content = await fs.readFile(path.resolve(process.cwd(), relativePath));
	return content.toString();
}

async function main() {
	if (!process.env.cvs_file) {
		console.log("csv file not found");
		return;
	}
	const userData = await readCSV(process.env.cvs_file);
	for (const user of userData) {
		await sendEmail({
			to: {
				name: user.Person || user.CompanyName,
				address: user.Email,
			},
			subject: process.env.email_subject,
		})
		.then(() => {
			console.log(`Email sent to ${user.Email} successfully`);
		}).catch((err) => {
			console.log(`Error sending email to ${user.Email}`, err);
		});
	}
}

main();