import React from 'react';
import { Card, Spin, Alert, Empty } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import { useSessionRecording } from '../api/proctoring';

interface SessionVideoPlayerProps {
    sessionId: string;
    title?: string;
}

/**
 * Video player component for viewing session recordings.
 * Used by teachers to review proctored exam sessions.
 */
const SessionVideoPlayer: React.FC<SessionVideoPlayerProps> = ({
    sessionId,
    title = 'Session Recording',
}) => {
    const { data: recording, isLoading, error } = useSessionRecording(sessionId);

    if (isLoading) {
        return (
            <Card title={title} size="small">
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin tip="Loading recording..." />
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card title={title} size="small">
                <Alert
                    type="warning"
                    message="Recording not available"
                    description="The session recording could not be loaded."
                    showIcon
                />
            </Card>
        );
    }

    if (!recording || !recording.video_url) {
        return (
            <Card title={title} size="small">
                <Empty
                    image={<VideoCameraOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
                    description="No recording available for this session"
                />
            </Card>
        );
    }

    return (
        <Card title={title} size="small">
            <video
                controls
                style={{ width: '100%', maxHeight: 400, backgroundColor: '#000' }}
                src={recording.video_url}
            >
                Your browser does not support the video tag.
            </video>
            {recording.duration_seconds && (
                <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                    Duration: {Math.floor(recording.duration_seconds / 60)}:{String(recording.duration_seconds % 60).padStart(2, '0')}
                </div>
            )}
        </Card>
    );
};

export default SessionVideoPlayer;
