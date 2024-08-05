use std::collections::HashMap;
use anyhow::{Error,Result};
use runtimelib::JupyterRuntime;


#[tauri::command]
pub async fn run_code(id: String, code: String) -> Result<String, String> {
    println!("Running code: {}", code);
    let client = reqwest::Client::new();
    let response = client
        .post(format!(
            "http://127.0.0.1:8080/v0/runtime_instances/{}/run_code",
            id,
        ))
        .json(&HashMap::from([("code", code)]))
        .send()
        .await.map_err(|e| format!("Failed to send request: {}", e))?
        .text()
        .await.map_err(|e| format!("Failed to send request: {}", e))?;

    // Deserialize the response
    let response: serde_json::Value = serde_json::from_str(&response).expect("Failed to parse JSON");
    let msg_id = response["msg_id"].as_str().unwrap();
    
    println!("Execution {} submitted, run\n", response["msg_id"]);
    println!("runt get-results {}", response["msg_id"]);
    println!("\nto get the results of the execution.");
    
    let exec = execution(String::from(msg_id)).await.map_err(|e| format!("Failed to get execution: {}", e))?;
    println!("the exec was {:?}", exec);
    Ok(exec)
}

pub async fn execution(id: String) -> Result<String, Error> {
    print!("Starting execution on {}", &id);
    let response = reqwest::get(format!("http://127.0.0.1:8080/v0/executions/{}", id))
        .await?
        .json::<Vec<serde_json::Value>>()
        .await?;
    println!("the execution result was {:?}", response);
    // Collect all the status: idle -> busy -> idle messages to determine when this started and stopped
    let status_changes = response
        .iter()
        .filter(|msg| msg["msg_type"] == "status")
        .map(|msg| {
            (
                msg["content"]["execution_state"].as_str().unwrap_or(""),
                msg["created_at"].as_str().unwrap_or(""),
            )
        })
        .collect::<Vec<_>>();

    let (start_time, end_time) = if let Some((first, rest)) = status_changes.split_first() {
        // Destructure the tuple (execution_state, created_at) for both first and last
        let (_, first_time) = first;
        let (_, last_time) = rest.last().unwrap_or(&("", ""));

        // Dereference both first_time and last_time to get &str from &&str
        (*first_time, *last_time)
    } else {
        ("", "")
    };

    let status = response
        .last()
        .map(|msg| {
            msg["content"]["execution_state"]
                .as_str()
                .unwrap_or("unknown")
        })
        .unwrap_or("unknown");

    let code = response
        .iter()
        .find(|msg| msg["msg_type"] == "execute_input")
        .map(|msg| msg["content"]["code"].as_str().unwrap_or(""));

    let results = response
        .iter()
        .filter_map(|msg| match msg["msg_type"].as_str() {
            Some("execute_result") | Some("display_data") => msg["content"]["data"]["text/plain"]
                .as_str()
                .map(ToString::to_string),
            Some("stream") => msg["content"]["text"].as_str().map(ToString::to_string),
            Some("error") => Some(format!(
                "Error: {}",
                msg["content"]["evalue"]
                    .as_str()
                    .unwrap_or("<unknown error>")
            )),
            _ => None,
        })
        .collect::<Vec<_>>();
    let res = serde_json::to_string(&response)?;
    print!("{:#?}", res);
    return Ok(serde_json::to_string(&response)?);
    
    // let mut builder = Builder::default();
    // 
    // builder.push_record(vec!["Execution Results"]);
    // builder.push_record(vec![format!("Execution ID: {}", id)]);
    // builder.push_record(vec![format!("Status: {}", status)]);
    // builder.push_record(vec![format!("Started: {}", start_time)]);
    // builder.push_record(vec![format!("Finished: {}", end_time)]);
    // builder.push_record(vec![""]);
    // 
    // // Code "block"
    // builder.push_record(vec!["-- Code --"]);
    // builder.push_record(vec![code.unwrap_or("").to_string()]);
    // builder.push_record(vec![""]);
    // builder.push_record(vec!["-- Output --"]);
    // for result in results {
    //     builder.push_record(vec![result.to_string()]);
    // }
    // builder.push_record(vec![""]);
    // 
    // let table = builder.build().with(Style::rounded()).to_string();
    // 
    // println!("{}", table);

    // Ok(())
}