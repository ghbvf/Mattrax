import { domainZone } from "./cloudflare";
import {
	CLOUDFLARE_ACCOUNT,
	CLOUDFLARE_ZONE,
	GITHUB_ORG,
	GITHUB_REPO,
	GITHUB_REPO_BRANCH,
	MDM_URL,
	PROD_HOST,
} from "./constants";
import { sesIdentity } from "./email";
import * as entraID from "./entraID";
import {
	type PagesProjectDeploymentConfigsProduction,
	PagesProject,
} from "./PagesProject";
import { secrets } from "./secrets";

const user = new aws.iam.User("MattraxWebIAMUser", {
	name: "mattrax-web-cloudflare",
});

new aws.iam.UserPolicy("MattraxWebIAMUserPolicy", {
	name: "SES",
	user: user.name,
	policy: sesIdentity.arn.apply((arn) =>
		aws.iam
			.getPolicyDocument({
				statements: [
					{ effect: "Allow", actions: ["ses:SendEmail"], resources: [arn] },
				],
			})
			.then((d) => d.json),
	),
});

const accessKey = new aws.iam.AccessKey("MattraxWebIAMUserAccessKey", {
	user: user.name,
});

const deploymentConfig = {
	compatibilityDate: "2024-04-03",
	compatibilityFlags: ["nodejs_compat", "nodejs_als"],
	link: [accessKey, entraID.app, entraID.appPassword],
	environmentVariables: {
		AWS_ACCESS_KEY_ID: accessKey.id,
		AWS_SECRET_ACCESS_KEY: accessKey.secret,
		ENTRA_CLIENT_ID: entraID.app.clientId,
		ENTRA_CLIENT_SECRET: entraID.appPassword.value,
		AUTH_SECRET: new random.RandomBytes("MattraxWebAuthSecret", {
			length: 64,
		}).base64,
		MDM_URL,
		INTERNAL_SECRET: secrets.InternalSecret.value,
		COOKIE_DOMAIN: CLOUDFLARE_ZONE,
		DATABASE_URL: $interpolate`https://:${secrets.InternalSecret.value}@${MDM_URL}`,
		FROM_ADDRESS: process.env.FROM_ADDRESS ?? "Mattrax <hello@mattrax.app>",
		PNPM_VERSION: "9.0.0",
		STRIPE_PUBLISHABLE_KEY:
			process.env.STRIPE_PUBLISHABLE_KEY ??
			"pk_test_51HWF7EHahv0c3616yp7ja6iTu2EDPzfnvd3cahDGHhPZQMAq8vqXa5QkJquWleLzkRK6KGppESxF8yZwWtBhCJzm00WAqF2c3k",
		STRIPE_SECRET_KEY: secrets.StripeSecretKey.value,
		FEEDBACK_DISCORD_WEBHOOK_URL: secrets.FeedbackDiscordWebhookURL.value,
		WAITLIST_DISCORD_WEBHOOK_URL: secrets.WaitlistDiscordWebhookURL.value,
		PROD_ORIGIN: `https://${PROD_HOST}`,
	},
	failOpen: true,
	placement: { mode: "smart" },
	usageModel: "standard",
} satisfies PagesProjectDeploymentConfigsProduction;

export const { inner: pagesProject } = new PagesProject(
	"MattraxWeb",
	{
		accountId: CLOUDFLARE_ACCOUNT,
		name: "mattrax",
		productionBranch: "main",
		buildConfig: {
			buildCaching: true,
			buildCommand: "pnpm cbuild",
			destinationDir: "dist",
			rootDir: "apps/web",
		},
		deploymentConfigs: {
			preview: deploymentConfig,
			production: deploymentConfig,
		},
		source: {
			config: {
				owner: GITHUB_ORG,
				previewBranchIncludes: ["*"],
				productionBranch: GITHUB_REPO_BRANCH,
				repoName: GITHUB_REPO,
			},
			type: "github",
		},
	},
	{ protect: true },
);

const domain = new cloudflare.PagesDomain("MattraxWebDomain", {
	accountId: CLOUDFLARE_ACCOUNT,
	projectName: pagesProject.name,
	domain: PROD_HOST,
});

// Without this, requests to /o/* will invoke the worker.
// We instead rewrite these requests to / so they load index.html from the CDN.
new cloudflare.Ruleset("MattraxWebSPAIndexRewriteRuleset", {
	kind: "zone",
	name: "default",
	phase: "http_request_transform",
	zoneId: domainZone.id,
	rules: [
		{
			enabled: true,
			action: "rewrite",
			expression: $interpolate`(http.host eq "${domain.domain}" and starts_with(http.request.uri.path, "/o"))`,
			description: "index.html rewrite",
			actionParameters: { uri: { path: { value: "/" } } },
		},
	],
});
