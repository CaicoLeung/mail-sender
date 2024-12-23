import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import "dotenv/config";
import type { Address } from "nodemailer/lib/mailer";
import { parse } from "csv-parse/sync";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import Ajv from "ajv";

const ajv = new Ajv();
const validate = ajv.compile({
	type: "object",
	properties: {
		host: { type: "string" },
		port: { type: "string" },
		secure: { type: "string" },
		user: { type: "string" },
		pass: { type: "string" },
	},
});

if (!validate(process.env)) {
	console.log(`environment variables are not valid. ${chalk.red("failed ❌")}`);
	console.log(validate.errors);
	process.exit(1);
}

async function sendEmail(
	params: Pick<Mail.Options, "to" | "subject" | "html" | "text">,
) {
	const transporter = nodemailer.createTransport({
		host: process.env.host || "smtp.gmail.com",
		port: process.env.port || "587",
		secure: process.env.secure === "true",
		auth: {
			user: process.env.user,
			pass: process.env.pass,
		},
	});
	const verify = await transporter.verify();

	if (verify) {
		if (!process.env.template_file) {
			console.log(`template file not found. ${chalk.red("failed ❌")}`);
			return;
		}
		const template = await readTemplate(process.env.template_file);
		await transporter.sendMail({
			from: process.env.user,
			to: params.to,
			replyTo: process.env.user,
			subject: params.subject,
			html: template.replace("{{name}}", (params.to as Address).name),
		});
	} else {
		console.log(`email service not verified. ${chalk.red("failed ❌")}`);
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
		console.log(`csv file not found. ${chalk.red("failed ❌")}`);
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
			console.log(
				`Email sent to ${user.Person || user.CompanyName} - ${user.Email} ${chalk.green("successfully ✔")}`,
			);
		}).catch((err) => {
			console.log(
				`Error sending email to ${user.Person || user.CompanyName} - ${user.Email} ${chalk.red("failed ❌")}`,
				err,
			);
		});
	}
}

main();