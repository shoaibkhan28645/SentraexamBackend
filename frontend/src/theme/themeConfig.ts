import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
    token: {
        fontSize: 14,
        colorPrimary: '#003eb3', // Academic Blue
        colorInfo: '#003eb3',
        colorSuccess: '#00b96b',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        fontFamily: "'Inter', sans-serif",
        borderRadius: 8,
        wireframe: false,
        colorBgLayout: '#f5f7fa',
    },
    components: {
        Button: {
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 500,
            controlHeight: 40,
            borderRadius: 8,
        },
        Typography: {
            fontFamily: "'Outfit', sans-serif",
            fontFamilyCode: "'Fira Code', monospace",
        },
        Card: {
            borderRadius: 12,
            boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        },
        Layout: {
            headerBg: '#ffffff',
            siderBg: '#001529',
        },
        Menu: {
            darkItemBg: 'transparent',
        },
        Input: {
            controlHeight: 40,
        },
        Select: {
            controlHeight: 40,
        }
    },
};

export default theme;
