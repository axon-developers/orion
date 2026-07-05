package com.axon.orion.execution.controller;

import com.axon.orion.execution.dto.ExecutionDtos;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.service.ExecutionService;
import com.axon.orion.execution.service.ExecutionReportService;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.user.entity.User;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ExecutionController.class)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
public class ExecutionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ExecutionService executionService;

    @MockBean
    private ExecutionReportService reportService;

    @MockBean
    private TestCaseRepository testCaseRepository;

    @MockBean
    private com.axon.orion.auth.filter.JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private com.axon.orion.auth.util.JwtUtil jwtUtil;

    @Test
    public void testTriggerExecutionAccepted() throws Exception {
        ExecutionDtos.ExecutionDto mockDto = new ExecutionDtos.ExecutionDto();
        mockDto.setId("exec-123");
        mockDto.setTestCaseId("tc-123");
        mockDto.setStatus("RUNNING");

        when(executionService.triggerExecution(any(), any())).thenReturn(mockDto);

        User mockUser = new User();
        mockUser.setId("user-123");
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                mockUser, null, java.util.Collections.emptyList()
        );

        String requestJson = """
                {
                    "testCaseId": "tc-123",
                    "environmentId": "env-123",
                    "variables": {}
                }
                """;

        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            mockMvc.perform(post("/api/executions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(requestJson))
                    .andExpect(status().isAccepted());
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    public void testListExecutionsOk() throws Exception {
        when(executionService.listExecutions(anyInt(), anyInt(), any(), any(), any(), any()))
                .thenReturn(com.axon.orion.common.dto.PagedResponse.of(
                        Collections.emptyList(), 0, 10, 0
                ));

        mockMvc.perform(get("/api/executions")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }
}
