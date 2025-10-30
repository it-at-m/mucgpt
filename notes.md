
# build lokal

docker build --build-arg COMMIT=$(git log -1 --format=%h) --build-arg VERSION=$(git describe --tags --abbrev=0)  --build-arg HTTPS_PROXY="<http://internet-proxy-client.muenchen.de:80>" --tag mucgpt .

# run local

docker run --detach --publish 8080:8000  --env-file=.env  mucgpt

# build dev

az acr build --build-arg COMMIT=$(git log -1 --format=%h) --build-arg VERSION=$(git describe --tags --abbrev=0) --resource-group rg-mucgpt-k-euw --registry containerreg966d60c9bdb7322c36bbd7cef0c418ca   --image mucgpt-c:latest .

# build demo

az acr build --build-arg COMMIT=$(git log -1 --format=%h) --build-arg VERSION=$(git describe --tags --abbrev=0) --resource-group rg-mucgpt-k-euw --registry containerreg966d60c9bdb7322c36bbd7cef0c418ca   --image mucgpt-k:latest .

# build prod

az acr build --build-arg COMMIT=$(git log -1 --format=%h) --build-arg VERSION=$(git describe --tags --abbrev=0) --resource-group rg-mucgpt-k-euw --registry containerreg966d60c9bdb7322c36bbd7cef0c418ca   --image mucgpt-p:latest .

# push image to c/k/p

 az acr login --name containerreg966d60c9bdb7322c36bbd7cef0c418ca

 docker tag mucgpt:latest containerreg966d60c9bdb7322c36bbd7cef0c418ca.azurecr.io/mucgpt-c:latest
 docker push containerreg966d60c9bdb7322c36bbd7cef0c418ca.azurecr.io/mucgpt-c:latest

 docker tag mucgpt:latest containerreg966d60c9bdb7322c36bbd7cef0c418ca.azurecr.io/mucgpt-k:latest
 docker push containerreg966d60c9bdb7322c36bbd7cef0c418ca.azurecr.io/mucgpt-k:latest

 docker tag mucgpt:latest containerreg966d60c9bdb7322c36bbd7cef0c418ca.azurecr.io/mucgpt-p:latest
 docker push containerreg966d60c9bdb7322c36bbd7cef0c418ca.azurecr.io/mucgpt-p:latest


## stack wip
docker-compose --profile=frontend --profile=backend up --build
