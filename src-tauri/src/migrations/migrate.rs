use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() {
    let migration = Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "CREATE TABLE if not exists Models (id STRING PRIMARY KEY, name TEXT, ARGS JSON, Parent STRING, );",
        kind: MigrationKind::Up,
    };
}