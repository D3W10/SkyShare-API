import { connectDB } from '$lib/models/db';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../file/$types';
import WebSocket from 'ws';
import type { RequestEvent } from '@sveltejs/kit';

// Store active WebSocket connections
const connections = new Map<string, WebSocket>();

export const GET: RequestHandler = async ({ request }: RequestEvent) => {
    // Check if it's a WebSocket upgrade request
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const ws = new WebSocket(request.url);
        
        // Generate a unique ID for this connection
        const connectionId = Math.random().toString(36).substring(2, 15);
        
        // Store the connection
        connections.set(connectionId, ws);
        
        // Handle WebSocket connection
        ws.on('open', () => {
            console.log('WebSocket connection established');
            ws.send(JSON.stringify({ type: 'connected', connectionId }));
        });
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('Received message:', data);
                
                // Handle different message types
                switch (data.type) {
                    case 'subscribe':
                        // Subscribe to a channel
                        subscribeToChannel(ws, data.channel);
                        break;
                    case 'unsubscribe':
                        // Unsubscribe from a channel
                        unsubscribeFromChannel(ws, data.channel);
                        break;
                    case 'message':
                        // Broadcast message to channel
                        broadcastToChannel(data.channel, data.message);
                        break;
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });
        
        ws.on('close', () => {
            console.log('WebSocket connection closed');
            connections.delete(connectionId);
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            connections.delete(connectionId);
        });
        
        return new Response(null, { status: 101 });
    }
    
    // Handle regular HTTP GET request
    const client = connectDB();
    
    try {
        await client.connect();
        return json({ success: true, message: 'File endpoint is ready' });
    } catch (error) {
        console.error('Error connecting to database:', error);
        return json({ success: false, error: 'Database connection error' }, { status: 500 });
    }
};

// Helper function to subscribe to a channel
function subscribeToChannel(ws: WebSocket, channel: string) {
    const client = connectDB();
    client.connect()
        .then(() => client.query(`LISTEN "${channel}"`))
        .then(() => {
            client.on('notification', (msg) => {
                ws.send(JSON.stringify({
                    type: 'notification',
                    channel: msg.channel,
                    payload: msg.payload
                }));
            });
        })
        .catch(error => {
            console.error('Error subscribing to channel:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to subscribe to channel'
            }));
        });
}

// Helper function to unsubscribe from a channel
function unsubscribeFromChannel(ws: WebSocket, channel: string) {
    const client = connectDB();
    client.connect()
        .then(() => client.query(`UNLISTEN "${channel}"`))
        .then(() => {
            ws.send(JSON.stringify({
                type: 'unsubscribed',
                channel
            }));
        })
        .catch(error => {
            console.error('Error unsubscribing from channel:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to unsubscribe from channel'
            }));
        });
}

// Helper function to broadcast message to a channel
function broadcastToChannel(channel: string, message: any) {
    const client = connectDB();
    client.connect()
        .then(() => client.query(`NOTIFY "${channel}", '${JSON.stringify(message)}'`))
        .catch(error => {
            console.error('Error broadcasting to channel:', error);
        });
}
