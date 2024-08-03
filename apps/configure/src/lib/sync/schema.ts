// This file defines all syncable entities.
// All exports are automatically registered.

import type { IDBPDatabase } from "idb";
import { z } from "zod";
import type { Database } from "../db";
import { getKey, setKey as putKey } from "../kv";
import { mapUser } from "../sync";
import { defineSyncEntity, merge, odataResponseSchema } from "./entity";
import { registerBatchedOperationAsync } from "./microsoft";
import { registerBatchedOperation } from "./state";

const userSchema = z.object({
	id: z.string(),
	displayName: z.string(),
	userPrincipalName: z.string(),
});

export async function me(db: IDBPDatabase<Database>, accessToken: string) {
	const oldMe = await getKey(db, "user");

	const responses = await registerBatchedOperationAsync(
		[
			{
				id: "me",
				method: "GET",
				url: "/me?$select=id,displayName,userPrincipalName",
			},
			{
				id: "mePhoto",
				method: "GET",
				url: "/me/photo/$value",
				headers: {
					"If-None-Match": oldMe?.avatarEtag,
				},
			},
		],
		accessToken,
	);

	const [me, mePhoto] = [responses[0]!, responses[1]!];

	if (me.status !== 200)
		throw new Error(`Failed to fetch me. Got status ${me.status}`);

	const result = userSchema.safeParse(me.body);
	if (result.error)
		throw new Error(`Failed to parse me response. ${result.error.message}`);

	const user = mapUser(result.data);

	// Will be `404` if the user has no photo.
	if (mePhoto.status === 200) {
		user.avatar = `data:image/*;base64,${mePhoto.body}`;
		user.avatarEtag = mePhoto.headers?.ETag;
	} else if (mePhoto.status !== 404 && mePhoto.status !== 304) {
		// We only log cause this is not a critical error.
		console.error(`Failed to fetch me photo. Got status ${mePhoto.status}`);
	}

	await putKey(db, "user", user);
}

const orgSchema = z.object({
	id: z.string(),
	displayName: z.string(),
	verifiedDomains: z.array(
		z.object({
			capabilities: z.string(),
			isDefault: z.boolean(),
			isInitial: z.boolean(),
			name: z.string(),
			type: z.enum(["Managed"]),
		}),
	),
});

export type Org = z.infer<typeof orgSchema>;

export async function organization(
	db: IDBPDatabase<Database>,
	accessToken: string,
) {
	const responses = await registerBatchedOperationAsync(
		{
			id: "organization",
			method: "GET",
			url: "/organization?$select=id,displayName,verifiedDomains",
		},
		accessToken,
	);

	const org = responses[0]!;

	if (org.status !== 200)
		throw new Error(`Failed to fetch org. Got status ${org.status}`);

	const result = odataResponseSchema(orgSchema).safeParse(org.body);
	if (result.error)
		throw new Error(
			`Failed to parse organization response. ${result.error.message}`,
		);

	if (result.data.value[0] === undefined) {
		throw new Error("No organisations was found!");
	} else if (result.data.value.length > 1) {
		console.warn("Found multiple organisations. Choosing the first one!");
	}

	await putKey(db, "org", result.data.value[0]);
}

export const users = defineSyncEntity("users", {
	endpoint:
		"/users/delta?$select=id,userType,userPrincipalName,displayName,givenName,surname,accountEnabled,employeeId,officeLocation,businessPhones,mobilePhone,preferredLanguage,lastPasswordChangeDateTime,createdDateTime",
	countEndpoint: "/users/$count",
	schema: z.object({
		id: z.string(),
		userType: z.enum(["Member", "Guest"]),
		userPrincipalName: z.string(),
		displayName: z.string(),
		givenName: z.string().optional(),
		surname: z.string().optional(),
		accountEnabled: z.boolean(),
		employeeId: z.string().optional(),
		officeLocation: z.string().optional(),
		businessPhones: z.array(z.string()).optional(),
		mobilePhone: z.string().optional(),
		preferredLanguage: z.string().optional(),
		lastPasswordChangeDateTime: z.string().optional(),
		createdDateTime: z.string(),
	}),
	upsert: async (db, data, _syncId) => {
		const tx = db.transaction("users", "readwrite");
		await tx.store.put(
			merge(await tx.store.get(data.id), {
				_syncId,
				id: data.id,
				type: data.userType === "Guest" ? "guest" : "member",
				upn: data.userPrincipalName,
				name: data.displayName,
				nameParts: {
					givenName: data.givenName,
					surname: data.surname,
				},
				accountEnabled: data.accountEnabled,
				employeeId: data.employeeId,
				officeLocation: data.officeLocation,
				phones: [
					...(data.businessPhones ?? []),
					...(data.mobilePhone ? [data.mobilePhone] : []),
				],
				preferredLanguage: data.preferredLanguage,
				lastPasswordChangeDateTime: data.lastPasswordChangeDateTime,
				createdDateTime: data.createdDateTime,
			}),
		);
		await tx.done;
	},
	delete: async (db, id) => await db.delete("users", id),
	cleanup: async (db, syncId) => {
		// const tx = db.transaction("users", "readwrite");
		// const users = tx.store.getAll();
		// for (const user of await users) {
		// 	if (user._syncId !== syncId) tx.store.delete(user.id);
		// }
		// await tx.done;
	},
});

function castLowerCase<T extends z.ZodTypeAny>(schema: T) {
	return z.preprocess(
		(s) => (typeof s === "string" ? s.toLowerCase() : s),
		schema,
	);
}

// TODO: Also sourcing extra data from "/deviceManagement/managedDevices"???
export const devices = defineSyncEntity("devices", {
	endpoint:
		"/devices/delta?$select=id,deviceId,displayName,deviceOwnership,profileType,trustType,enrollmentProfileName,enrollmentType,isCompliant,isManaged,isRooted,managementType,manufacturer,model,operatingSystem,operatingSystemVersion,approximateLastSignInDateTime,registrationDateTime,deviceCategory",
	countEndpoint: "/devices/$count",
	schema: z.object({
		id: z.string(),
		deviceId: z.string(),
		displayName: z.string(),
		deviceOwnership: castLowerCase(
			z.enum(["company", "personal", "unknown"]),
		).default("unknown"),
		profileType: z
			.enum(["RegisteredDevice", "SecureVM", "Printer", "Shared", "IoT"])
			.optional(),
		trustType: z.enum(["Workplace", "AzureAd", "ServerAd"]).optional(),
		enrollmentProfileName: z.string().optional(),
		enrollmentType: z
			.enum([
				"unknown",
				"userEnrollment",
				"deviceEnrollmentManager",
				"appleBulkWithUser",
				"appleBulkWithoutUser",
				"windowsAzureADJoin",
				"windowsBulkUserless",
				"windowsAutoEnrollment",
				"windowsBulkAzureDomainJoin",
				"windowsCoManagement",

				// This isn't in the docs but it is in the data so...
				// TODO: Maybe check OpenAPI docs if we can discover more values they aren't telling us about?
				"AzureDomainJoined",
				"DeviceEnrollment",
			])
			.default("unknown"),
		isCompliant: z.boolean().optional(),
		isManaged: z.boolean().default(false),
		isRooted: z.boolean().default(false),
		managementType: castLowerCase(
			z.enum([
				"eas",
				"mdm",
				"easMdm",
				"intuneClient",
				"easIntuneClient",
				"configurationManagerClient",
				"configurationManagerClientMdm",
				"configurationManagerClientMdmEas",
				"unknown",
				"jamf",
				"googleCloudDevicePolicyController",
			]),
		).default("unknown"),
		manufacturer: z.string().optional(),
		model: z.string().optional(),
		operatingSystem: z.string().optional(),
		operatingSystemVersion: z.string().optional(),
		approximateLastSignInDateTime: z.string().optional(),
		registrationDateTime: z.string().optional(),
		deviceCategory: z.string().optional(),
	}),
	upsert: async (db, data, _syncId) => {
		const tx = db.transaction("devices", "readwrite");
		await tx.store.put(
			merge(await tx.store.get(data.id), {
				_syncId,
				id: data.id,
				deviceId: data.deviceId,
				name: data.displayName,
				deviceOwnership: data.deviceOwnership,
				type: data.profileType,
				trustType: data.trustType || "unknown",
				enrollment: {
					profileName: data.enrollmentProfileName,
					type: data.enrollmentType,
				},
				isCompliant: data.isCompliant,
				isManaged: data.isManaged,
				isRooted: data.isRooted,
				managementType: data.managementType,
				manufacturer: data.manufacturer,
				model: data.model,
				operatingSystem: data.operatingSystem,
				operatingSystemVersion: data.operatingSystemVersion,
				lastSignInDate: data.approximateLastSignInDateTime,
				registrationDateTime: data.registrationDateTime,
				deviceCategory: data.deviceCategory,
			}),
		);
		await tx.done;
	},
	delete: async (db, id) => await db.delete("devices", id),
	cleanup: async (db, syncId) => {
		// const tx = db.transaction("devices", "readwrite");
		// const devices = tx.store.getAll();
		// for (const device of await devices) {
		// 	if (device._syncId !== syncId) tx.store.delete(device.id);
		// }
		// await tx.done;
	},
});

export const groups = defineSyncEntity("groups", {
	endpoint:
		"/groups/delta?$select=id,displayName,description,securityEnabled,visibility,createdDateTime,members",
	countEndpoint: "/groups/$count",
	schema: z.object({
		id: z.string(),
		displayName: z.string(),
		description: z.string().optional(),
		securityEnabled: z.boolean().default(false),
		visibility: z.enum(["Private", "Public", "HiddenMembership"]).nullable(),
		createdDateTime: z.string(),
		"members@delta": z
			.array(
				z.object({
					"@odata.type": z.union([
						z.literal("#microsoft.graph.user"),
						z.literal("#microsoft.graph.group"),
						z.literal("#microsoft.graph.device"),
						z.literal("#microsoft.graph.servicePrincipal"),
					]),
					id: z.string(),
					"@removed": z.object({}).passthrough().optional(),
				}),
			)
			.default([]),
	}),
	upsert: async (db, data, _syncId) => {
		const tx = db.transaction(["groups", "groupMembers"], "readwrite");
		const groups = tx.objectStore("groups");
		await groups.put(
			merge(await groups.get(data.id), {
				_syncId,
				id: data.id,
				name: data.displayName,
				description: data.description,
				securityEnabled: data.securityEnabled,
				visibility: data.visibility ?? undefined,
				createdDateTime: data.createdDateTime,
			}),
		);

		const members = tx.objectStore("groupMembers");
		for (const member of data["members@delta"]) {
			if (member["@removed"]) {
				await members.delete(data.id);
			} else {
				members.put({
					_syncId,
					groupId: data.id,
					type: member["@odata.type"],
					id: member.id,
				});
			}
		}

		await tx.done;
	},
	delete: async (db, id) => await db.delete("groups", id),
	cleanup: async (db, syncId) => {
		// const tx = db.transaction(["groups", "groupMembers"], "readwrite");
		// const groups = tx.objectStore("groups").getAll();
		// for (const device of await groups) {
		// 	if (device._syncId !== syncId) tx.store.delete(device.id);
		// }
		// await tx.done;
	},
});

const assignmentTarget = z.discriminatedUnion("@odata.type", [
	z.object({
		"@odata.type": z.enum([
			"#microsoft.graph.exclusionGroupAssignmentTarget",
			"#microsoft.graph.groupAssignmentTarget",
		]),
		deviceAndAppManagementAssignmentFilterId: z.string().nullable(),
		deviceAndAppManagementAssignmentFilterType: z.enum([
			"none",
			"include",
			"exclude",
		]),
		groupId: z.string(),
	}),
	z.object({
		"@odata.type": z.enum([
			"#microsoft.graph.allLicensedUsersAssignmentTarget",
			"#microsoft.graph.allDevicesAssignmentTarget",
		]),
		deviceAndAppManagementAssignmentFilterId: z.string().nullable(),
		deviceAndAppManagementAssignmentFilterType: z.enum([
			"none",
			"include",
			"exclude",
		]),
	}),
]);

export const policies = defineSyncEntity("policies", {
	endpoint: [
		// Settings Catalogs
		"/deviceManagement/configurationPolicies?$select=id,name,description,platforms,technologies,createdDateTime,lastModifiedDateTime&$expand=assignments,settings",
		// Templates
		"/deviceManagement/deviceConfigurations?$select=id,displayName,description,createdDateTime,lastModifiedDateTime,version&$expand=assignments&$count=true",
	],
	countEndpoint: undefined,
	schema: z.preprocess(
		(val) =>
			typeof val !== "object" || val === null
				? val
				: "@odata.type" in val
					? val
					: { ...val, "@odata.type": "__NO_ODATA_TYPE__" },

		z.intersection(
			z.object({
				id: z.string(),
				description: z
					.string()
					.nullable()
					// Microsoft's endpoints are inconsistent.
					.transform((v) => (v === "" ? null : v)),
				createdDateTime: z.string(),
				lastModifiedDateTime: z.string(),
				assignments: z.array(
					z.object({
						id: z.string(),
						source: z.enum(["direct", "policySets"]),
						sourceId: z.string(),
						target: assignmentTarget,
					}),
				),
			}),
			z.discriminatedUnion("@odata.type", [
				z.object({
					"@odata.type": z.literal("__NO_ODATA_TYPE__"),
					name: z.string(),
					platforms: z.any(), // TODO: Type
					// creationSource: z.any(),
					// templateReference: z.any(),
					// priority: z.any(),
					settings: z.array(z.any()), // TODO: Type
				}),
				z.object({
					"@odata.type": z.enum([
						"#microsoft.graph.iosCustomConfiguration",
						"#microsoft.graph.windows10CustomConfiguration",
						"#microsoft.graph.windows10GeneralConfiguration",
						"#microsoft.graph.windowsWifiConfiguration",
						// TODO: Find all of them
					]),
					displayName: z.string(),
					version: z.number(),
				}),
			]),
		),
	),
	upsert: async (db, data, _syncId) => {
		const tx = db.transaction(["policies", "policiesAssignments"], "readwrite");
		const policies = tx.objectStore("policies");
		await policies.put(
			merge(await policies.get(data.id), {
				_syncId,
				id: data.id,
				description: data.description ?? undefined,
				createdDateTime: data.createdDateTime,
				lastModifiedDateTime: data.lastModifiedDateTime,
				...(data["@odata.type"] === "__NO_ODATA_TYPE__"
					? {
							name: data.name,
							platforms: data.platforms,
							settings: data.settings,
						}
					: {
							name: data.displayName,
							"@odata.type": data["@odata.type"],
							version: data.version,
						}),
			}),
		);

		// const assignments = tx.objectStore("policiesAssignments");
		// for (const member of data["members@delta"]) {
		// 	if (member["@removed"]) {
		// 		await members.delete(data.id);
		// 	} else {
		// 		members.put({
		// 			_syncId,
		// 			groupId: data.id,
		// 			type: member["@odata.type"],
		// 			id: member.id,
		// 		});
		// 	}
		// }

		await tx.done;
	},
	delete: async (db, id) => await db.delete("policies", id),
	cleanup: async (db, syncId) => {
		const tx = db.transaction(["policies", "policiesAssignments"], "readwrite");
		const policies = tx.objectStore("policies");
		for (const e of await policies.getAll()) {
			if (e._syncId !== syncId) policies.delete(e.id);
		}

		const policiesAssignments = tx.objectStore("policiesAssignments");
		for (const e of await policiesAssignments.getAll()) {
			if (e._syncId !== syncId) policiesAssignments.delete(e.id);
		}
		await tx.done;
	},
});

export const scripts = defineSyncEntity("scripts", {
	endpoint: [
		// Powershell
		"/deviceManagement/deviceManagementScripts?$expand=assignments,groupAssignments&$count=true",
		// Shell
		"/deviceManagement/deviceShellScripts?$expand=assignments,groupAssignments&$count=true",
	],
	countEndpoint: undefined,
	schema: z.intersection(
		z.object({
			id: z.string(),
			displayName: z.string(),
			description: z
				.string()
				.nullable()
				// Microsoft's endpoints are cringe.
				.transform((v) => (v === "" ? null : v)),
			createdDateTime: z.string(),
			lastModifiedDateTime: z.string(),
			runAsAccount: z.enum(["system", "user"]),
			fileName: z.string(),
			scriptContent: z.string().nullable(),
			assignments: z.array(
				z.object({
					id: z.string(),
					target: z.object({
						"@odata.type": z.enum([
							"#microsoft.graph.allDevicesAssignmentTarget",
							"#microsoft.graph.allLicensedUsersAssignmentTarget",
							"microsoft.graph.scopeTagGroupAssignmentTarget",
							// TODO: Any other ones?
						]),
						deviceAndAppManagementAssignmentFilterId: z.string().nullable(),
						deviceAndAppManagementAssignmentFilterType: z.string(),
						targetType: z.string().optional(),
						entraObjectId: z.string().optional(),
					}),
				}),
			),
			groupAssignments: z.array(
				z.object({
					id: z.string(),
					targetGroupId: z.string(),
				}),
			),
		}),
		z.union([
			z.object({
				executionFrequency: z.string().duration(),
				retryCount: z.number(),
				blockExecutionNotifications: z.boolean(),
			}),
			z.object({
				enforceSignatureCheck: z.boolean(),
				runAs32Bit: z.boolean(),
			}),
		]),
	),
	upsert: async (db, data, _syncId) => {
		const tx = db.transaction(["scripts", "scriptAssignments"], "readwrite");
		const scripts = tx.objectStore("scripts");
		await scripts.put(
			merge(await scripts.get(data.id), {
				_syncId,
				id: data.id,
				name: data.displayName,
				description: data.description ?? undefined,
				createdDateTime: data.createdDateTime,
				lastModifiedDateTime: data.lastModifiedDateTime,
				runAsAccount: data.runAsAccount,
				fileName: data.fileName,
				scriptContent: data.scriptContent ?? undefined,
				...("executionFrequency" in data
					? {
							// Bash
							executionFrequency: data.executionFrequency,
							retryCount: data.retryCount,
							blockExecutionNotifications: data.blockExecutionNotifications,
						}
					: {
							// Powershell
							enforceSignatureCheck: data.enforceSignatureCheck,
							runAs32Bit: data.runAs32Bit,
						}),
			}),
		);

		// const assignments = tx.objectStore("scriptAssignments");
		// for (const member of data["members@delta"]) {
		// 	if (member["@removed"]) {
		// 		await members.delete(data.id);
		// 	} else {
		// 		members.put({
		//			_syncId,
		// 			groupId: data.id,
		// 			type: member["@odata.type"],
		// 			id: member.id,
		// 		});
		// 	}
		// }

		await tx.done;
	},
	delete: async (db, id) => await db.delete("scripts", id),
	cleanup: async (db, syncId) => {
		const tx = db.transaction(["scripts", "scriptAssignments"], "readwrite");
		const scripts = tx.objectStore("scripts");
		for (const e of await scripts.getAll()) {
			if (e._syncId !== syncId) scripts.delete(e.id);
		}

		const scriptAssignments = tx.objectStore("scriptAssignments");
		for (const e of await scriptAssignments.getAll()) {
			if (e._syncId !== syncId) scriptAssignments.delete(e.id);
		}
		await tx.done;
	},
});

export const apps = defineSyncEntity("apps", {
	endpoint:
		"/deviceAppManagement/mobileApps?$select=id,displayName,description,publisher,largeIcon,createdDateTime,lastModifiedDateTime,isFeatured,privacyInformationUrl,informationUrl,owner,developer,notes&$expand=assignments",
	countEndpoint: undefined,
	schema: z.object({
		id: z.string(),
		"@odata.type": z.union([
			z.literal("#microsoft.graph.iosStoreApp"),
			z.literal("#microsoft.graph.managedIOSStoreApp"),
			z.literal("#microsoft.graph.managedAndroidStoreApp"),
			z.literal("#microsoft.graph.managedAndroidStoreApp"),
			z.literal("#microsoft.graph.winGetApp"),
			// TODO: Work out all variants
		]),
		displayName: z.string(),
		description: z.string().optional(),
		publisher: z.string().optional(),
		largeIcon: z.any().optional(),
		createdDateTime: z.string(),
		lastModifiedDateTime: z.string(),
		isFeatured: z.boolean().default(false),
		privacyInformationUrl: z.string().nullable(),
		informationUrl: z.string().nullable(),
		owner: z.string().nullable(),
		developer: z.string().nullable(),
		notes: z.string().nullable(),
		assignments: z
			.array(
				z.object({
					id: z.string(),
					intent: z.enum([
						"available",
						"required",
						"uninstall",
						"availableWithoutEnrollment",
					]),
					source: z.enum(["direct", "policySets"]),
					sourceId: z.string().nullable(),
					target: assignmentTarget,
					settings: z.discriminatedUnion("@odata.type", [
						z.object({
							"@odata.type": z.literal(
								"#microsoft.graph.iosStoreAppAssignmentSettings",
							),
							vpnConfigurationId: z.unknown().optional(),
							uninstallOnDeviceRemoval: z.boolean(),
							isRemovable: z.boolean(),
							preventManagedAppBackup: z.boolean(),
						}),
						z.object({
							"@odata.type": z.literal(
								"#microsoft.graph.winGetAppAssignmentSettings",
							),
							notifications: z.enum([
								"showAll",
								"showReboot",
								"hideAll",
								"unknownFutureValue",
							]),
							restartSettings: z
								.object({
									gracePeriodInMinutes: z.number(),
									countdownDisplayBeforeRestartInMinutes: z.number(),
									restartNotificationSnoozeDurationInMinutes: z.number(),
								})
								.nullable(),
							installTimeSettings: z
								.object({
									useLocalTime: z.boolean(),
									deadlineDateTime: z.string(), // TODO: Date
								})
								.nullable(),
						}),
					]),
				}),
			)
			.default([]),
	}),
	upsert: async (db, data, _syncId) => {
		const tx = db.transaction(["apps", "appAssignments"], "readwrite");
		const apps = tx.objectStore("apps");
		await apps.put(
			merge(await apps.get(data.id), {
				_syncId,
				id: data.id,
				type: data["@odata.type"],
				name: data.displayName,
				description: data.description,
				publisher: data.publisher,
				largeIcon: data.largeIcon,
				createdDateTime: data.createdDateTime,
				lastModifiedDateTime: data.lastModifiedDateTime,
				isFeatured: data.isFeatured,
				privacyInformationUrl: data.privacyInformationUrl ?? undefined,
				informationUrl: data.informationUrl ?? undefined,
				owner: data.owner ?? undefined,
				developer: data.developer ?? undefined,
				notes: data.notes ?? undefined,
			}),
		);

		// const assignments = tx.objectStore("appAssignments");
		// for (const assignment of data.assignments) {
		// 	if (member["@removed"]) {
		// 		await members.delete(data.id);
		// 	} else {
		// 		members.put({
		// 			groupId: data.id,
		// 			type: member["@odata.type"],
		// 			id: member.id,
		// 		});
		// 	}
		// }

		await tx.done;
	},
	delete: async (db, id) => await db.delete("apps", id),
	cleanup: async (db, syncId) => {
		const tx = db.transaction(["apps", "appAssignments"], "readwrite");
		const apps = tx.objectStore("apps");
		for (const e of await apps.getAll()) {
			if (e._syncId !== syncId) apps.delete(e.id);
		}

		const appAssignments = tx.objectStore("appAssignments");
		for (const e of await appAssignments.getAll()) {
			if (e._syncId !== syncId) appAssignments.delete(e.id);
		}
		await tx.done;
	},
});

// TODO: https://graph.microsoft.com/beta/deviceManagement/reusableSettings
// TODO: https://graph.microsoft.com/beta/deviceManagement/configurationSettings
// TODO: https://graph.microsoft.com/beta/deviceManagement/configurationCategories
