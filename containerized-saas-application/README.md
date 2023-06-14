This directory is a representation of a sample dockerized application, that will be deployed in a [Silo model](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-isolation.html) across individual tenants using [AWS Proton](https://aws.amazon.com/proton/).

The idea is to show that you can deploy your existing monolith application across multiple tenants in a Silo model, under circrumstances where you want to go-to-market faster without spending effort on refactoring your application to a [pool isolation model](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/pool-isolation.html).


Below commands builds and run the docker image using the Dockerfile. You can then browse the application in your browser at http://localhost:80

```
docker build -t "mymonolith" .
docker run mymonolith:latest 
```


