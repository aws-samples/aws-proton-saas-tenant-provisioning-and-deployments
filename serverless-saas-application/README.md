This directory contains the lambda functions for your microservice that the application/product team is responsible for building. These lambda functions are deployed using AWS Proton service template that resides inside "service-templates/serverless-service/" folder. Please refer the instructions in that folder to understand how Proton leverages these lambda functions and deploy the serverless application across multiple tenants in Silo model or across multiple tiers in a hybrid model. 

In our case, the Proton service template accepts reserved concurrency as a parameter which demonstates that you can deploy the "same" serverless application across multiple tenants/tiers with different configurations, such as reserved concurrency, provisioned concurrency, memory size etc.

You can run below commands, in case you want to deploy this application as standalone, without using AWS Proton.

```
cd ../service-templates/serverless-service/v1/instance_infrastructure
npm install     
cd ../../../../   
npm install
cdk deploy
```