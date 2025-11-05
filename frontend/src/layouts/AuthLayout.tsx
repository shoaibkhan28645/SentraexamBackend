import React from 'react';
import { Layout, Card } from 'antd';
import { BookOutlined } from '@ant-design/icons';

const { Content } = Layout;

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Card
          style={{
            width: '100%',
            maxWidth: 450,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <BookOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <h1 style={{ marginTop: 16, fontSize: 28, fontWeight: 'bold' }}>Sentraexam</h1>
            <p style={{ color: '#8c8c8c' }}>Academic Management Platform</p>
          </div>
          {children}
        </Card>
      </Content>
    </Layout>
  );
};

export default AuthLayout;
