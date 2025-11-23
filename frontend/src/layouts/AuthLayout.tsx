import React from 'react';
import { Layout, Card, Row, Col, Typography, theme } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import educationIllustration from '../assets/education-illustration.svg';

const { Content } = Layout;
const { Title, Text } = Typography;

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const {
    token: { colorPrimary },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh', background: '#ffffff' }}>
      <Content>
        <Row style={{ minHeight: '100vh' }}>
          {/* Left Side - Form */}
          <Col xs={24} md={12} lg={10} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: `${colorPrimary}15`,
                  marginBottom: 16
                }}>
                  <BookOutlined style={{ fontSize: 32, color: colorPrimary }} />
                </div>
                <Title level={2} style={{ margin: '0 0 8px', fontFamily: "'Outfit', sans-serif" }}>Sentraexam</Title>
                <Text type="secondary" style={{ fontSize: 16 }}>Academic Management Platform</Text>
              </div>

              <Card
                bordered={false}
                style={{
                  boxShadow: 'none',
                  background: 'transparent'
                }}
                bodyStyle={{ padding: 0 }}
              >
                {children}
              </Card>

              <div style={{ marginTop: 40, textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  &copy; {new Date().getFullYear()} Sentraexam. All rights reserved.
                </Text>
              </div>
            </div>
          </Col>

          {/* Right Side - Illustration */}
          <Col xs={0} md={12} lg={14} style={{
            background: `linear-gradient(135deg, ${colorPrimary} 0%, #00b96b 100%)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }} />

            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: 40 }}>
              <img
                src={educationIllustration}
                alt="Education"
                style={{ maxWidth: '80%', maxHeight: '50vh', marginBottom: 40, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))' }}
              />
              <Title level={1} style={{ color: '#fff', marginBottom: 16, fontFamily: "'Outfit', sans-serif" }}>
                Empowering Education
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, maxWidth: 500, display: 'block', margin: '0 auto' }}>
                Streamline assessments, manage courses, and track student progress with our comprehensive platform.
              </Text>
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default AuthLayout;
