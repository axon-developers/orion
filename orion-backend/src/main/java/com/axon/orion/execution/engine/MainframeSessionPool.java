package com.axon.orion.execution.engine;

import com.bytezone.dm3270.TerminalClient;
import com.bytezone.dm3270.ConnectionListener;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class MainframeSessionPool {

    // executionId -> (sessionKey -> TerminalClient)
    private final Map<String, Map<String, TerminalClient>> pools = new ConcurrentHashMap<>();
    private final Map<TerminalClient, Boolean> connectionStates = new ConcurrentHashMap<>();

    public TerminalClient getClient(String executionId, String host, int port, int timeoutMs) throws Exception {
        if (executionId == null) {
            // Direct validation run (no execution ID context): do not pool
            TerminalClient client = new TerminalClient(2, new com.bytezone.dm3270.display.ScreenDimensions(24, 80));
            client.setConnectionTimeoutMillis(timeoutMs);
            client.setUsesExtended3270(true);
            client.connect(host, port);
            return client;
        }

        Map<String, TerminalClient> execPool = pools.computeIfAbsent(executionId, k -> new ConcurrentHashMap<>());
        String key = host + ":" + port;

        TerminalClient client = execPool.get(key);
        if (client == null || !isClientConnected(client)) {
            synchronized (execPool) {
                client = execPool.get(key);
                if (client == null || !isClientConnected(client)) {
                    final TerminalClient newClient = new TerminalClient(2, new com.bytezone.dm3270.display.ScreenDimensions(24, 80));
                    newClient.setConnectionTimeoutMillis(timeoutMs);
                    newClient.setUsesExtended3270(true);

                    newClient.addConnectionListener(new ConnectionListener() {
                        @Override
                        public void onConnection() {
                            connectionStates.put(newClient, true);
                        }

                        @Override
                        public void onConnectionClosed() {
                            connectionStates.put(newClient, false);
                        }

                        @Override
                        public void onException(Exception e) {
                            connectionStates.put(newClient, false);
                        }
                    });

                    log.info("Connecting new mainframe terminal for execution {} to {}:{}", executionId, host, port);
                    newClient.connect(host, port);
                    connectionStates.put(newClient, true);

                    client = newClient;
                    execPool.put(key, client);
                }
            }
        } else {
            log.debug("Reused existing mainframe terminal connection for execution {} to {}:{}", executionId, host, port);
        }

        return client;
    }

    public boolean isClientConnected(TerminalClient client) {
        return client != null && connectionStates.getOrDefault(client, false);
    }

    public void closeSessions(String executionId) {
        if (executionId == null) return;
        Map<String, TerminalClient> execPool = pools.remove(executionId);
        if (execPool != null) {
            for (Map.Entry<String, TerminalClient> entry : execPool.entrySet()) {
                try {
                    TerminalClient client = entry.getValue();
                    if (client != null) {
                        connectionStates.remove(client);
                        client.disconnect();
                        log.info("Closed mainframe terminal connection for execution {} and key {}", executionId, entry.getKey());
                    }
                } catch (Exception e) {
                    log.error("Failed to close mainframe terminal connection for execution {}: {}", executionId, e.getMessage());
                }
            }
        }
    }
}
