def lambda_handler(event, context):
    print(event)            
    index = event["iterator"]["index"]
    step = event["iterator"]["step"]
    total_waves = int(event["iterator"]["total_waves"])
    
    index = index + step
    
    iterator = {}
    iterator["index"] = index
    iterator["step"] = index
    iterator["total_waves"] = total_waves
    
    if index < total_waves:
        iterator["continue"] = True
    else:
        iterator["continue"] = False
        
    
    return({
        "iterator": iterator,
        "instances": event["instances"],
        "service_spec": event["service_spec"],
        "service_name": event["service_name"]
    })