const dashboardStats = {
  totalApps: 148,
  pipelines: 624,
  clusters: 19,
  approvals: 8,
  successRate: "96.4%"
};

const recentDeployments = [
  {
    app: "payments-api",
    team: "core-platform",
    env: "prod",
    platform: "OpenShift",
    status: "Success"
  },
  {
    app: "orders-api",
    team: "commerce",
    env: "qa",
    platform: "EKS",
    status: "Running"
  },
  {
    app: "inventory-service",
    team: "retail",
    env: "prod",
    platform: "Kubernetes",
    status: "Pending"
  }
];

const applications = [
  {
    name: "payments-api",
    team: "platform",
    env: "prod",
    platform: "OpenShift",
    onboarding: "Completed",
    deployment: "Active",
    route: "https://payments.company.com"
  },
  {
    name: "orders-api",
    team: "commerce",
    env: "qa",
    platform: "EKS",
    onboarding: "Completed",
    deployment: "Running",
    route: "https://orders.company.com"
  }
];

const clusters = [
  {
    name: "openshift-prod-01",
    platform: "OpenShift",
    region: "DC1",
    status: "Connected"
  },
  {
    name: "eks-shared-dev",
    platform: "EKS",
    region: "ap-south-1",
    status: "Connected"
  },
  {
    name: "gke-core",
    platform: "GKE",
    region: "asia-south1",
    status: "Validation Pending"
  }
];

const approvals = [
  {
    id: "REQ-1001",
    app: "payments-api",
    requester: "sree",
    env: "prod",
    action: "Deployment Approval",
    submitted: "10 mins ago",
    status: "Pending"
  }
];

const auditLogs = [
  {
    user: "platform-admin",
    action: "Generated GitLab pipeline",
    platform: "GitLab",
    time: "2026-05-27 10:20"
  },
  {
    user: "sree",
    action: "Created onboarding request",
    platform: "OpenShift",
    time: "2026-05-27 09:12"
  }
];