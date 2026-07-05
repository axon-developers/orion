package com.axon.orion.execution.controller;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = RecordingProxyController.class)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
public class RecordingProxyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private com.axon.orion.auth.filter.JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private com.axon.orion.auth.util.JwtUtil jwtUtil;

    private static HttpServer mockServer;
    private static int port;

    @BeforeAll
    public static void startServer() throws IOException {
        mockServer = HttpServer.create(new InetSocketAddress(0), 0);
        port = mockServer.getAddress().getPort();
        
        mockServer.createContext("/test", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String html = "<html><head><link href='/style.css'></head><body>" +
                        "<h1>Target Site</h1>" +
                        "<a href='/next-page'>Next</a>" +
                        "</body></html>";
                exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
                exchange.sendResponseHeaders(200, html.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(html.getBytes());
                }
            }
        });
        
        mockServer.start();
    }

    @AfterAll
    public static void stopServer() {
        if (mockServer != null) {
            mockServer.stop(0);
        }
    }

    @Test
    public void testProxyEndpointRewritingAndInjection() throws Exception {
        String targetUrl = "http://localhost:" + port + "/test";

        mockMvc.perform(get("/api/record/proxy")
                        .param("url", targetUrl))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("/api/record/proxy?url=http%3A%2F%2Flocalhost%3A")))
                .andExpect(content().string(containsString("%2Fstyle.css")))
                .andExpect(content().string(containsString("<script src=\"/api/record/recorder.js\"></script>")));
    }
}
