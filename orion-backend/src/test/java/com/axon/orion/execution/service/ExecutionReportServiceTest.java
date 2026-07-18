package com.axon.orion.execution.service;

import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.ExecutionStepLog;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.execution.repository.ExecutionStepLogRepository;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

public class ExecutionReportServiceTest {

    private ExecutionReportService reportService;

    @Mock
    private ExecutionRepository executionRepository;
    @Mock
    private ExecutionStepLogRepository stepLogRepository;
    @Mock
    private TestCaseRepository testCaseRepository;
    @Mock
    private EnvironmentRepository environmentRepository;
    @Mock
    private TestStepRepository testStepRepository;
    @Mock
    private JavaMailSender mailSender;

    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        reportService = new ExecutionReportService(
                executionRepository,
                stepLogRepository,
                testCaseRepository,
                environmentRepository,
                testStepRepository,
                mailSender,
                objectMapper
        );
    }

    @Test
    public void testGetHtmlReportSimplifiedFormat() {
        String execId = "exec-1";
        String testCaseId = "tc-1";
        String stepId = "step-1";

        Execution execution = new Execution();
        execution.setId(execId);
        execution.setTestCaseId(testCaseId);
        execution.setStatus(Execution.Status.PASSED);
        execution.setStartedAt(Instant.now());
        execution.setPassedSteps(1);
        execution.setTotalSteps(1);

        TestCase testCase = new TestCase();
        testCase.setId(testCaseId);
        testCase.setName("Test Simplification Case");

        TestStep step = new TestStep();
        step.setId(stepId);
        step.setName("HTTP Get Request");
        step.setStepType(TestStep.StepType.HTTP_REQUEST);

        ExecutionStepLog log = new ExecutionStepLog();
        log.setId("log-1");
        log.setExecutionId(execId);
        log.setTestStepId(stepId);
        log.setSequenceOrder(1);
        log.setStatus(ExecutionStepLog.Status.PASSED);
        log.setStepType("HTTP_REQUEST");
        log.setInputPayload("{\"method\":\"GET\",\"url\":\"https://api.example.com/users\"}");
        log.setOutputPayload("{\"statusCode\":200,\"body\":\"{\\\"id\\\":123,\\\"name\\\":\\\"John\\\"}\"}");

        when(executionRepository.findById(execId)).thenReturn(Optional.of(execution));
        when(testCaseRepository.findById(testCaseId)).thenReturn(Optional.of(testCase));
        when(testStepRepository.findById(stepId)).thenReturn(Optional.of(step));
        when(stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(execId)).thenReturn(List.of(log));

        String html = reportService.getHtmlReport(execId);

        // 1. Verify CSS class metadata-grid is present
        assertThat(html).contains(".metadata-grid");
        
        // 2. Verify simplified inputs are present
        assertThat(html).contains("Endpoint");
        assertThat(html).contains("GET https://api.example.com/users");
        assertThat(html).contains("Status Code");
        
        // 3. Verify raw JSON inputs & outputs are NOT printed in their old format
        assertThat(html).doesNotContain("Resolved Input Payload");
        assertThat(html).doesNotContain("Output Response");
        assertThat(html).doesNotContain("{\\\"id\\\":123");
    }

    @Test
    public void testGetHtmlReportWithBrowserAutomationScreenshotsOnly() {
        String execId = "exec-2";
        String testCaseId = "tc-2";
        String stepId = "step-2";

        Execution execution = new Execution();
        execution.setId(execId);
        execution.setTestCaseId(testCaseId);
        execution.setStatus(Execution.Status.PASSED);
        execution.setStartedAt(Instant.now());
        execution.setPassedSteps(1);
        execution.setTotalSteps(1);

        TestCase testCase = new TestCase();
        testCase.setId(testCaseId);
        testCase.setName("Browser Automation Case");

        TestStep step = new TestStep();
        step.setId(stepId);
        step.setName("Login Flow");
        step.setStepType(TestStep.StepType.BROWSER_AUTOMATION);

        ExecutionStepLog log = new ExecutionStepLog();
        log.setId("log-2");
        log.setExecutionId(execId);
        log.setTestStepId(stepId);
        log.setSequenceOrder(1);
        log.setStatus(ExecutionStepLog.Status.PASSED);
        log.setStepType("BROWSER_AUTOMATION");
        log.setInputPayload("{\"actions\":[{\"type\":\"navigate\",\"url\":\"https://example.com\"}]}");
        log.setOutputPayload("{\"screenshots\":[{\"name\":\"homepage\",\"filename\":\"mock.png\"}],\"actions\":[{\"type\":\"navigate\",\"status\":\"SUCCESS\"}]}");

        when(executionRepository.findById(execId)).thenReturn(Optional.of(execution));
        when(testCaseRepository.findById(testCaseId)).thenReturn(Optional.of(testCase));
        when(testStepRepository.findById(stepId)).thenReturn(Optional.of(step));
        when(stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(execId)).thenReturn(List.of(log));

        String html = reportService.getHtmlReport(execId);

        // 1. Verify screenshots gallery is rendered
        assertThat(html).contains("screenshot-gallery");
        assertThat(html).contains("homepage");

        // 2. Verify raw automation action details and list are NOT printed
        assertThat(html).doesNotContain("Executed Automation Actions");
        assertThat(html).doesNotContain("SUCCESS");
    }
}
