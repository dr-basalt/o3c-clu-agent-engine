# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the O3C Agent Engine on Kubernetes clusters (Kubero, Rancher, or any K8s cluster).

## Prerequisites

- Kubernetes cluster (v1.24+)
- `kubectl` configured to access your cluster
- Ingress controller installed (nginx-ingress or traefik)
- cert-manager installed (for automatic SSL certificates)
- Storage class configured for persistent volumes

## Quick Start

### 1. Create Secrets

First, create your secrets file from the example:

```bash
cp secret.yaml.example secret.yaml
```

Edit `secret.yaml` and replace all `CHANGE_ME` values with secure secrets:

```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
openssl rand -base64 32  # For ENCRYPTION_KEY
openssl rand -base64 16  # For passwords
```

### 2. Update Ingress Domain

Edit `ingress.yaml` and replace `your-domain.com` with your actual domain.

### 3. Update Docker Image

Edit `api-deployment.yaml` and replace `your-registry/o3c-api:latest` with your actual Docker image.

### 4. Deploy to Kubernetes

Apply all manifests in order:

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml

# Create Persistent Volume Claims
kubectl apply -f pvc.yaml

# Deploy PostgreSQL
kubectl apply -f postgres-deployment.yaml

# Deploy Redis
kubectl apply -f redis-deployment.yaml

# Deploy API
kubectl apply -f api-deployment.yaml

# Create Ingress
kubectl apply -f ingress.yaml
```

Or deploy everything at once:

```bash
kubectl apply -f .
```

### 5. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n o3c-agent-engine

# Check services
kubectl get svc -n o3c-agent-engine

# Check ingress
kubectl get ingress -n o3c-agent-engine

# View logs
kubectl logs -f deployment/o3c-api -n o3c-agent-engine
```

## Hetzner Cloud + Cloudflare Setup

### Hetzner Load Balancer

1. Create a Load Balancer in Hetzner Cloud Console
2. Point it to your Kubernetes cluster nodes
3. Configure health checks on port 80/443

### Cloudflare Configuration

1. Add your domain to Cloudflare
2. Create A records pointing to Hetzner Load Balancer IP:
   ```
   A    @              <hetzner-lb-ip>
   A    api            <hetzner-lb-ip>
   A    *.your-domain  <hetzner-lb-ip>
   ```
3. Enable Cloudflare proxy (orange cloud)
4. SSL/TLS mode: Full (strict)

## Kubero Deployment

If using Kubero:

1. Connect your Kubero instance to your Git repository
2. Kubero will automatically detect the Dockerfile
3. Configure environment variables in Kubero UI
4. Deploy via Kubero pipeline

## Rancher Deployment

If using Rancher:

1. Import your cluster to Rancher
2. Create a new namespace: `o3c-agent-engine`
3. Use Rancher's App Catalog or import these manifests
4. Configure secrets via Rancher's secret management
5. Deploy workloads

## Scaling

The deployment includes a HorizontalPodAutoscaler that will automatically scale the API pods based on CPU and memory usage:

- Min replicas: 2
- Max replicas: 10
- Scale up when CPU > 70% or Memory > 80%

To manually scale:

```bash
kubectl scale deployment o3c-api -n o3c-agent-engine --replicas=5
```

## Monitoring

### View Logs

```bash
# API logs
kubectl logs -f deployment/o3c-api -n o3c-agent-engine

# PostgreSQL logs
kubectl logs -f deployment/postgres -n o3c-agent-engine

# Redis logs
kubectl logs -f deployment/redis -n o3c-agent-engine
```

### Health Checks

The API includes health check endpoints:

- `/api/v1/health` - Basic health check
- `/api/v1/health/ready` - Readiness probe (checks DB connection)
- `/api/v1/health/metrics` - System metrics

## Backup and Restore

### Backup PostgreSQL

```bash
kubectl exec -n o3c-agent-engine deployment/postgres -- pg_dump -U o3c_user o3c_agent_engine > backup.sql
```

### Restore PostgreSQL

```bash
kubectl exec -i -n o3c-agent-engine deployment/postgres -- psql -U o3c_user o3c_agent_engine < backup.sql
```

### Backup Workspaces

```bash
kubectl exec -n o3c-agent-engine deployment/o3c-api -- tar czf - /data/workspaces > workspaces-backup.tar.gz
```

## Troubleshooting

### Pods Not Starting

```bash
kubectl describe pod <pod-name> -n o3c-agent-engine
kubectl logs <pod-name> -n o3c-agent-engine
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it deployment/postgres -n o3c-agent-engine -- psql -U o3c_user -d o3c_agent_engine

# Check database service
kubectl get svc postgres-service -n o3c-agent-engine
```

### Ingress Not Working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx  # or kube-system

# Check ingress events
kubectl describe ingress o3c-ingress -n o3c-agent-engine

# Check cert-manager (if using)
kubectl get certificates -n o3c-agent-engine
```

## Cleanup

To remove the entire deployment:

```bash
kubectl delete namespace o3c-agent-engine
```

To remove specific components:

```bash
kubectl delete -f api-deployment.yaml
kubectl delete -f postgres-deployment.yaml
kubectl delete -f redis-deployment.yaml
```

## Security Considerations

1. **Secrets**: Never commit `secret.yaml` to Git. Use Kubernetes secrets or external secret managers (Vault, Sealed Secrets)
2. **Network Policies**: Consider adding NetworkPolicy to restrict pod-to-pod communication
3. **RBAC**: Implement Role-Based Access Control for cluster access
4. **Image Scanning**: Scan Docker images for vulnerabilities before deployment
5. **Update Strategy**: Use rolling updates to ensure zero downtime

## Production Checklist

- [ ] Secrets are generated and secured
- [ ] Domain is configured and pointed to load balancer
- [ ] SSL certificates are issued and valid
- [ ] Database backups are configured
- [ ] Monitoring and alerting are set up
- [ ] Resource limits are appropriate for your workload
- [ ] Horizontal Pod Autoscaler is tested
- [ ] Persistent volumes are backed up
- [ ] Disaster recovery plan is documented
