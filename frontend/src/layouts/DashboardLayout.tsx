import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Button, theme, Typography } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  FileTextOutlined,
  BellOutlined,
  FolderOutlined,
  CalendarOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const {
    token: { colorBgContainer, colorPrimary },
  } = theme.useToken();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Generate menu items based on user role
  const getMenuItems = () => {
    const items = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      },
    ];

    // Admin-only items
    if (user?.role === UserRole.ADMIN) {
      items.push({
        key: '/dashboard/users',
        icon: <UserOutlined />,
        label: 'Users',
      });
    }

    // Admin and HOD items
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.HOD) {
      items.push({
        key: '/dashboard/departments',
        icon: <TeamOutlined />,
        label: 'Departments',
      });
    }

    // All authenticated users
    items.push(
      {
        key: '/dashboard/courses',
        icon: <BookOutlined />,
        label: 'Courses',
      },
      {
        key: '/dashboard/assessments',
        icon: <FileTextOutlined />,
        label: 'Assessments',
      },
      {
        key: '/dashboard/notifications',
        icon: <BellOutlined />,
        label: 'Notifications',
      },
      {
        key: '/dashboard/documents',
        icon: <FolderOutlined />,
        label: 'Documents',
      },
      {
        key: '/dashboard/calendar',
        icon: <CalendarOutlined />,
        label: 'Calendar',
      }
    );

    return items;
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/dashboard/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/dashboard/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // Get current path for menu highlighting
  const selectedKey = location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#001529',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 24 : 28,
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            background: 'rgba(255,255,255,0.05)',
            marginBottom: 16,
            letterSpacing: collapsed ? 0 : 1,
          }}
        >
          {collapsed ? 'SE' : 'Sentraexam'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={getMenuItems()}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            borderRight: 0,
            padding: '0 8px',
          }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 260, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            height: 72,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '18px',
              width: 48,
              height: 48,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Badge count={5} offset={[-5, 5]} color={colorPrimary}>
              <Button
                type="text"
                shape="circle"
                icon={<BellOutlined style={{ fontSize: 20 }} />}
                onClick={() => navigate('/dashboard/notifications')}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 12, padding: '4px 8px', borderRadius: 8, transition: 'background 0.3s' }} className="user-dropdown">
                <Avatar
                  icon={<UserOutlined />}
                  style={{ backgroundColor: colorPrimary, verticalAlign: 'middle' }}
                  size="large"
                />
                {user && (
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      {user.first_name} {user.last_name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {user.role}
                    </Text>
                  </div>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px',
            padding: 0,
            minHeight: 280,
            borderRadius: 12,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;
