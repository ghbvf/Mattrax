// This file was generated by '@mattrax/drizzle-to-rs'
#![allow(unused)]
use chrono::NaiveDateTime;
use mysql_async::{prelude::*, BinaryProtocol, Deserialized, QueryResult, Serialized};

// 'FromValue::from_value' but 'track_caller'
#[track_caller]
fn from_value<T: FromValue>(row: &mut mysql_async::Row, index: usize) -> T {
    let v = row.take(index).unwrap();
    match T::from_value_opt(v) {
        Ok(this) => this,
        Err(e) => {
            let column_name = row
                .columns_ref()
                .get(index)
                .map(|c| c.name_str())
                .unwrap_or("unknown".into());
            let type_name = std::any::type_name::<T>();
            panic!("Could not retrieve {type_name:?} from column {column_name:?}: {e}")
        }
    }
}

#[derive(Debug)]
pub struct GetConfigResult {
    pub value: Vec<u8>,
}

#[derive(Debug)]
pub struct GetDomainResult {
    pub created_at: NaiveDateTime,
}
#[derive(Debug)]
pub struct GetSessionAndUserAccountResult {
    pub pk: u64,
    pub id: String,
}
#[derive(Debug)]
pub struct GetSessionAndUserSessionResult {
    pub id: String,
    pub expires_at: NaiveDateTime,
}
#[derive(Debug)]
pub struct GetSessionAndUserResult {
    pub account: GetSessionAndUserAccountResult,
    pub session: GetSessionAndUserSessionResult,
}
#[derive(Debug)]
pub struct IsOrgMemberResult {
    pub id: String,
}

#[derive(Debug)]
pub struct GetDeviceResult {
    pub pk: u64,
    pub tenant_pk: u64,
}
#[derive(Debug)]
pub struct GetDeviceBySerialResult {
    pub id: String,
    pub tenant_pk: u64,
}
#[derive(Debug)]
pub struct GetPolicyDataForCheckinLatestDeployResult {
    pub pk: u64,
    pub data: Deserialized<serde_json::Value>,
}
#[derive(Debug)]
pub struct GetPolicyDataForCheckinLastDeployResult {
    pub pk: u64,
    pub data: Deserialized<serde_json::Value>,
    pub conflicts: Option<Deserialized<serde_json::Value>>,
}
#[derive(Debug)]
pub struct GetPolicyDataForCheckinResult {
    pub scope: String,
    pub policy_pk: u64,
    pub latest_deploy: GetPolicyDataForCheckinLatestDeployResult,
    pub last_deploy: Option<GetPolicyDataForCheckinLastDeployResult>,
}
#[derive(Debug)]
pub struct QueuedDeviceActionsResult {
    pub action: String,
    pub device_pk: u64,
    pub created_by: u64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug)]
pub struct GetPendingDeployStatusesResult {
    pub deploy_pk: u64,
    pub conflicts: Option<Deserialized<serde_json::Value>>,
}
#[derive(Debug)]
pub struct CreatePolicyDeployStatus {
    pub device_pk: u64,
    pub deploy_pk: u64,
    pub conflicts: Option<String>,
}

#[derive(Clone)]
pub struct Db {
    pool: mysql_async::Pool,
}

impl std::ops::Deref for Db {
    type Target = mysql_async::Pool;

    fn deref(&self) -> &Self::Target {
        &self.pool
    }
}

impl std::ops::DerefMut for Db {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.pool
    }
}

impl Db {
    pub fn new(db_url: &str) -> Self {
        Self {
            pool: mysql_async::Pool::new(db_url),
        }
    }
}

impl Db {
    pub async fn get_config(&self) -> Result<Vec<GetConfigResult>, mysql_async::Error> {
        let mut result = r#"select `value` from `kv` where `kv`.`key` = ?"#
            .with(mysql_async::Params::Positional(vec!["config"
                .clone()
                .into()]))
            .run(&self.pool)
            .await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(GetConfigResult {
                value: from_value(&mut row, 0),
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn set_config(&self, config: String) -> Result<(), mysql_async::Error> {
        let mut result = r#"insert into `kv` (`key`, `value`, `last_modified`) values (?, ?, default) on duplicate key update `value` = ?"#.with(mysql_async::Params::Positional(vec!["config".clone().into(),config.clone().into(),config.clone().into()])).run(&self.pool).await?;
        Ok(())
    }
}
impl Db {
    pub async fn get_domain(
        &self,
        domain: String,
    ) -> Result<Vec<GetDomainResult>, mysql_async::Error> {
        let mut result = r#"select `created_at` from `domains` where `domains`.`domain` = ?"#
            .with(mysql_async::Params::Positional(vec![domain.clone().into()]))
            .run(&self.pool)
            .await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(GetDomainResult {
                created_at: from_value(&mut row, 0),
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn get_session_and_user(
        &self,
        session_id: String,
    ) -> Result<Vec<GetSessionAndUserResult>, mysql_async::Error> {
        let mut result = r#"select `accounts`.`pk`, `accounts`.`id`, `session`.`id`, `session`.`expires_at` from `session` inner join `accounts` on `session`.`account` = `accounts`.`id` where `session`.`id` = ?"#.with(mysql_async::Params::Positional(vec![session_id.clone().into()])).run(&self.pool).await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(GetSessionAndUserResult {
                account: GetSessionAndUserAccountResult {
                    pk: from_value(&mut row, 0),
                    id: from_value(&mut row, 1),
                },
                session: GetSessionAndUserSessionResult {
                    id: from_value(&mut row, 2),
                    expires_at: from_value(&mut row, 3),
                },
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn is_org_member(
        &self,
        org_slug: String,
        account_pk: u64,
    ) -> Result<Vec<IsOrgMemberResult>, mysql_async::Error> {
        let mut result = r#"select `organisations`.`id` from `organisations` inner join `organisation_members` on (`organisations`.`pk` = `organisation_members`.`org` and `organisation_members`.`account` = ?) where `organisations`.`slug` = ?"#.with(mysql_async::Params::Positional(vec![account_pk.clone().into(),org_slug.clone().into()])).run(&self.pool).await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(IsOrgMemberResult {
                id: from_value(&mut row, 0),
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn create_device(
        &self,
        id: String,
        mdm_id: String,
        name: String,
        enrollment_type: String,
        os: String,
        serial_number: String,
        tenant_pk: u64,
        owner_pk: Option<u64>,
        enrolled_by_pk: Option<u64>,
    ) -> Result<(), mysql_async::Error> {
        let mut result = r#"insert into `devices` (`pk`, `id`, `mdm_id`, `name`, `description`, `enrollment_type`, `os`, `serial_number`, `manufacturer`, `model`, `os_version`, `imei`, `free_storage`, `total_storage`, `owner`, `azure_ad_did`, `enrolled_at`, `enrolled_by`, `last_synced`, `tenant`) values (default, ?, ?, ?, default, ?, ?, ?, default, default, default, default, default, default, ?, default, default, ?, default, ?) on duplicate key update `mdm_id` = ?, `name` = ?, `enrollment_type` = ?, `os` = ?, `serial_number` = ?, `owner` = ?, `enrolled_by` = ?, `tenant` = ?"#.with(mysql_async::Params::Positional(vec![id.clone().into(),mdm_id.clone().into(),name.clone().into(),enrollment_type.clone().into(),os.clone().into(),serial_number.clone().into(),owner_pk.clone().into(),enrolled_by_pk.clone().into(),tenant_pk.clone().into(),mdm_id.clone().into(),name.clone().into(),enrollment_type.clone().into(),os.clone().into(),serial_number.clone().into(),owner_pk.clone().into(),enrolled_by_pk.clone().into(),tenant_pk.clone().into()])).run(&self.pool).await?;
        Ok(())
    }
}
impl Db {
    pub async fn get_device(
        &self,
        mdm_device_id: String,
    ) -> Result<Vec<GetDeviceResult>, mysql_async::Error> {
        let mut result = r#"select `pk`, `tenant` from `devices` where `devices`.`mdm_id` = ?"#
            .with(mysql_async::Params::Positional(vec![mdm_device_id
                .clone()
                .into()]))
            .run(&self.pool)
            .await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(GetDeviceResult {
                pk: from_value(&mut row, 0),
                tenant_pk: from_value(&mut row, 1),
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn get_device_by_serial(
        &self,
        serial_number: String,
    ) -> Result<Vec<GetDeviceBySerialResult>, mysql_async::Error> {
        let mut result =
            r#"select `id`, `tenant` from `devices` where `devices`.`serial_number` = ?"#
                .with(mysql_async::Params::Positional(vec![serial_number
                    .clone()
                    .into()]))
                .run(&self.pool)
                .await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(GetDeviceBySerialResult {
                id: from_value(&mut row, 0),
                tenant_pk: from_value(&mut row, 1),
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn get_policy_data_for_checkin(
        &self,
        device_pk: u64,
    ) -> Result<Vec<GetPolicyDataForCheckinResult>, mysql_async::Error> {
        let mut result = r#"select `scope_li`, `l`.`policy`, `l`.`pk`, `l`.`data`, `j`.`pk`, `j`.`data`, `j`.`conflicts` from (select `policy_deploy`.`pk`, `policy_deploy`.`policy`, `policy_deploy`.`data`, `scope_li` from `policy_deploy` inner join (select max(`policy_deploy`.`pk`) as `deployPk`, `policy_deploy`.`policy`, max(`scope`) as `scope_li` from (select `pk`, min(`scope`) as `scope` from ((select `policies`.`pk`, 'direct' as `scope` from `policies` inner join `policy_assignables` on `policies`.`pk` = `policy_assignables`.`policy` where (`policy_assignables`.`variant` = ? and `policy_assignables`.`pk` = ?)) union all (select `policies`.`pk`, 'group' as `scope` from `policies` inner join `policy_assignables` on (`policies`.`pk` = `policy_assignables`.`policy` and `policy_assignables`.`variant` = ?) inner join `group_assignables` on `group_assignables`.`group` = `policy_assignables`.`pk` where (`group_assignables`.`variant` = ? and `group_assignables`.`pk` = ?))) `scoped` group by `scoped`.`pk`) `sorted` inner join `policy_deploy` on `sorted`.`pk` = `policy_deploy`.`policy` group by `policy_deploy`.`policy`) `li` on `deployPk` = `policy_deploy`.`pk`) `l` left join (select `policy_deploy`.`pk`, `policy_deploy`.`policy`, `policy_deploy`.`data`, `policy_deploy_status`.`conflicts`, `ji_scope` from `policy_deploy` inner join (select max(`policy_deploy`.`pk`) as `deployPk`, `policy_deploy`.`policy`, max(`scope`) as `ji_scope` from (select `pk`, min(`scope`) as `scope` from ((select `policies`.`pk`, 'direct' as `scope` from `policies` inner join `policy_assignables` on `policies`.`pk` = `policy_assignables`.`policy` where (`policy_assignables`.`variant` = ? and `policy_assignables`.`pk` = ?)) union all (select `policies`.`pk`, 'group' as `scope` from `policies` inner join `policy_assignables` on (`policies`.`pk` = `policy_assignables`.`policy` and `policy_assignables`.`variant` = ?) inner join `group_assignables` on `group_assignables`.`group` = `policy_assignables`.`pk` where (`group_assignables`.`variant` = ? and `group_assignables`.`pk` = ?))) `scoped` group by `scoped`.`pk`) `sorted` inner join `policy_deploy` on `sorted`.`pk` = `policy_deploy`.`policy` inner join `policy_deploy_status` on (`policy_deploy`.`pk` = `policy_deploy_status`.`deploy` and `policy_deploy_status`.`device` = ?) group by `policy_deploy`.`policy`) `ji` on `deployPk` = `policy_deploy`.`pk` inner join `policy_deploy_status` on (`policy_deploy`.`pk` = `policy_deploy_status`.`deploy` and `policy_deploy_status`.`device` = ?)) `j` on `j`.`policy` = `l`.`policy`"#.with(mysql_async::Params::Positional(vec!["device".clone().into(),device_pk.clone().into(),"group".clone().into(),"device".clone().into(),device_pk.clone().into(),"device".clone().into(),device_pk.clone().into(),"group".clone().into(),"device".clone().into(),device_pk.clone().into(),device_pk.clone().into(),device_pk.clone().into()])).run(&self.pool).await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(GetPolicyDataForCheckinResult {
                scope: from_value(&mut row, 0),
                policy_pk: from_value(&mut row, 1),
                latest_deploy: GetPolicyDataForCheckinLatestDeployResult {
                    pk: from_value(&mut row, 2),
                    data: from_value(&mut row, 3),
                },
                last_deploy: {
                    let pk = from_value(&mut row, 4);
                    let data = from_value(&mut row, 5);
                    let conflicts = from_value(&mut row, 6);

                    match (pk, data) {
                        (Some(pk), Some(data)) => Some(GetPolicyDataForCheckinLastDeployResult {
                            pk,
                            data,
                            conflicts,
                        }),
                        _ => None,
                    }
                },
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn queued_device_actions(
        &self,
        device_id: u64,
    ) -> Result<Vec<QueuedDeviceActionsResult>, mysql_async::Error> {
        let mut result = r#"select `action`, `device`, `created_by`, `created_at` from `device_actions` where `device_actions`.`device` = ?"#.with(mysql_async::Params::Positional(vec![device_id.clone().into()])).run(&self.pool).await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(QueuedDeviceActionsResult {
                action: from_value(&mut row, 0),
                device_pk: from_value(&mut row, 1),
                created_by: from_value(&mut row, 2),
                created_at: from_value(&mut row, 3),
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn update_device_lastseen(&self, device_id: u64) -> Result<(), mysql_async::Error> {
        let last_synced = chrono::Utc::now().naive_utc();
        let mut result = r#"update `devices` set `last_synced` = ? where `devices`.`pk` = ?"#
            .with(mysql_async::Params::Positional(vec![
                last_synced.clone().into(),
                device_id.clone().into(),
            ]))
            .run(&self.pool)
            .await?;
        Ok(())
    }
}
impl Db {
    pub async fn get_pending_deploy_statuses(
        &self,
        device_pk: u64,
    ) -> Result<Vec<GetPendingDeployStatusesResult>, mysql_async::Error> {
        let mut result = r#"select `deploy`, `conflicts` from `policy_deploy_status` where (`policy_deploy_status`.`variant` = ? and `policy_deploy_status`.`device` = ?)"#.with(mysql_async::Params::Positional(vec!["pending".clone().into(),device_pk.clone().into()])).run(&self.pool).await?;
        let mut ret = vec![];
        while let Some(mut row) = result.next().await.unwrap() {
            ret.push(GetPendingDeployStatusesResult {
                deploy_pk: from_value(&mut row, 0),
                conflicts: from_value(&mut row, 1),
            });
        }
        Ok(ret)
    }
}
impl Db {
    pub async fn create_policy_deploy_status(
        &self,
        values: Vec<CreatePolicyDeployStatus>,
    ) -> Result<(), mysql_async::Error> {
        let done_at = chrono::Utc::now().naive_utc();
        let mut result = format!(r#"insert into `policy_deploy_status` (`deploy`, `device`, `variant`, `conflicts`, `done_at`) values {}"#, (0..values.len()).map(|_| "(?, ?, ?, ?, ?)").collect::<Vec<_>>().join(",")).with(mysql_async::Params::Positional(values.into_iter().map(|v| vec![v.deploy_pk.clone().into(),v.device_pk.clone().into(),"pending".clone().into(),v.conflicts.clone().into(),done_at.clone().into()]).flatten().collect())).run(&self.pool).await?;
        Ok(())
    }
}
