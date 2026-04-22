from app.utils.storage import load_data

def check_cluster_instances(cluster_id):
    """检查集群下是否有实例"""
    instances = load_data('instances.json')
    related = [i for i in instances if i.get('cluster_id') == cluster_id]
    return related

def check_instance_databases(instance_id):
    """检查实例下是否有数据库"""
    databases = load_data('databases.json')
    related = [d for d in databases if d.get('instance_id') == instance_id]
    return related

def check_instance_users(instance_id):
    """检查实例下是否有数据库用户"""
    users = load_data('db_users.json')
    related = [u for u in users if u.get('instance_id') == instance_id]
    return related

def check_database_user_permissions(database_id):
    """检查数据库是否有用户权限"""
    users = load_data('db_users.json')
    related = []
    for user in users:
        permissions = user.get('permissions', [])
        if any(p.get('database_id') == database_id for p in permissions):
            related.append(user)
    return related
