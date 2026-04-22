const STORAGE_KEY = 'tdsql_data';
const USERS_KEY = 'tdsql_users';

const DEFAULT_USERS = [
  { id: 1, username: 'admin', password: 'password123', role: 'admin', name: '管理员' },
  { id: 2, username: 'ops', password: 'password123', role: 'ops', name: '运维人员' },
  { id: 3, username: 'user', password: 'password123', role: 'user', name: '普通用户' }
];

const DEFAULT_DATA = {
  clusters: [
    { id: 1, name: '集群A', description: '主集群', is_xinchuang: false, is_dingjia: true },
    { id: 2, name: '集群B', description: '测试集群', is_xinchuang: true, is_dingjia: false }
  ],
  instances: [
    { id: 1, name: '实例1', cluster_id: 1, cluster_name: '集群A', internal_port: 3306, external_port: 13306, status: 'online', description: '生产实例' },
    { id: 2, name: '实例2', cluster_id: 1, cluster_name: '集群A', internal_port: 3307, external_port: 13307, status: 'unused', description: '备用实例' },
    { id: 3, name: '实例3', cluster_id: 2, cluster_name: '集群B', internal_port: 3308, external_port: 13308, status: 'offline', description: '测试实例' }
  ],
  databases: [
    { id: 1, name: 'db_app', instance_id: 1, instance_name: '实例1', cluster_id: 1, cluster_name: '集群A' },
    { id: 2, name: 'db_user', instance_id: 1, instance_name: '实例1', cluster_id: 1, cluster_name: '集群A' },
    { id: 3, name: 'db_test', instance_id: 3, instance_name: '实例3', cluster_id: 2, cluster_name: '集群B' }
  ],
  db_users: [
    { id: 1, username: 'app_user', instance_id: 1, instance_name: '实例1', cluster_id: 1, cluster_name: '集群A', app_id: 1, app_name: '应用A', permissions_detail: [{ database_name: 'db_app', privileges: ['SELECT', 'INSERT'] }] },
    { id: 2, username: 'reader', instance_id: 1, instance_name: '实例1', cluster_id: 1, cluster_name: '集群A', app_id: null, app_name: '', permissions_detail: [{ database_name: 'db_user', privileges: ['SELECT'] }] }
  ],
  apps: [
    { id: 1, name: '应用A', domain: 'app.example.com', developer_name: '张三', operator_name: '李四', description: '主业务应用' }
  ],
  groups: [
    { id: 1, name: '开发组', description: '开发人员' },
    { id: 2, name: '运维组', description: '运维人员' }
  ],
  staff: [
    { id: 1, name: '张三', code: 'zhangsan', group_id: 1, group_name: '开发组' },
    { id: 2, name: '李四', code: 'lisi', group_id: 2, group_name: '运维组' }
  ],
  activities: [
    { id: 1, type: '登录', user: 'admin', description: '用户登录', timestamp: new Date().toISOString() }
  ]
};

function getData(context) {
  let data = context.env.TDSQL_DATA;
  if (!data) {
    data = DEFAULT_DATA;
  } else {
    try {
      data = JSON.parse(data);
    } catch {
      data = DEFAULT_DATA;
    }
  }
  return data;
}

function getUsers(context) {
  let users = context.env.TDSQL_USERS;
  if (!users) {
    users = DEFAULT_USERS;
  } else {
    try {
      users = JSON.parse(users);
    } catch {
      users = DEFAULT_USERS;
    }
  }
  return users;
}

function makeResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  if (path === '/api/auth/login' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const { username, password } = body;
      const users = getUsers(context);
      const user = users.find(u => u.username === username && u.password === password);
      
      if (user) {
        const token = btoa(JSON.stringify({ id: user.id, username: user.username, role: user.role }));
        return makeResponse({ success: true, token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
      }
      return makeResponse({ success: false, error: '用户名或密码错误' }, 401);
    } catch {
      return makeResponse({ error: '请求格式错误' }, 400);
    }
  }

  if (path === '/api/auth/me' && context.request.method === 'GET') {
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const user = JSON.parse(atob(token));
        return makeResponse({ user });
      } catch {
        return makeResponse({ error: '无效的令牌' }, 401);
      }
    }
    return makeResponse({ error: '未登录' }, 401);
  }

  if (path === '/api/cluster' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.clusters });
  }

  if (path === '/api/instance' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.instances });
  }

  if (path === '/api/database' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.databases });
  }

  if (path === '/api/user/db-users' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.db_users });
  }

  if (path === '/api/dictionary/apps' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.apps });
  }

  if (path === '/api/dictionary/groups' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.groups });
  }

  if (path === '/api/dictionary/staff' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.staff });
  }

  if (path === '/api/activity' && context.request.method === 'GET') {
    const data = getData(context);
    return makeResponse({ data: data.activities });
  }

  return makeResponse({ error: 'Not Found' }, 404);
}
