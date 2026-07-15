package com.axon.orion.testcase.service;

import com.axon.orion.testcase.entity.TestSuite;
import com.axon.orion.testcase.repository.TestSuiteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
public class TestSuiteSchedulerService {

    private final TestSuiteRepository testSuiteRepository;
    private TestSuiteService testSuiteService;
    private final ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();

    private final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public TestSuiteSchedulerService(TestSuiteRepository testSuiteRepository) {
        this.testSuiteRepository = testSuiteRepository;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public void setTestSuiteService(@org.springframework.context.annotation.Lazy TestSuiteService testSuiteService) {
        this.testSuiteService = testSuiteService;
    }

    @EventListener(ContextRefreshedEvent.class)
    public void initScheduler() {
        taskScheduler.setPoolSize(5);
        taskScheduler.setThreadNamePrefix("suite-sched-");
        taskScheduler.initialize();
        log.info("Initialized Test Suite ThreadPoolTaskScheduler.");
        rescheduleAll();
    }

    public synchronized void rescheduleAll() {
        // Cancel all existing tasks
        scheduledTasks.forEach((id, future) -> future.cancel(false));
        scheduledTasks.clear();

        // Get enabled suites and schedule them
        for (TestSuite suite : testSuiteRepository.findByEnabledTrue()) {
            scheduleSuite(suite);
        }
    }

    public synchronized void scheduleSuite(TestSuite suite) {
        if (!suite.isEnabled() || suite.getCronExpression() == null || suite.getCronExpression().isBlank()) {
            cancelSuite(suite.getId());
            return;
        }

        cancelSuite(suite.getId());

        try {
            ScheduledFuture<?> future = taskScheduler.schedule(
                    () -> {
                        try {
                            log.info("Cron trigger fired for test suite '{}' ({})", suite.getName(), suite.getId());
                            testSuiteService.runSuite(suite.getId(), "SYSTEM_SCHEDULER");
                        } catch (Exception e) {
                            log.error("Error executing scheduled test suite {}: {}", suite.getId(), e.getMessage(), e);
                        }
                    },
                    new CronTrigger(suite.getCronExpression())
            );
            scheduledTasks.put(suite.getId(), future);
            log.info("Scheduled test suite '{}' with cron: '{}'", suite.getName(), suite.getCronExpression());
        } catch (IllegalArgumentException e) {
            log.error("Invalid cron expression '{}' for suite '{}': {}", suite.getCronExpression(), suite.getName(), e.getMessage());
        }
    }

    public synchronized void cancelSuite(String suiteId) {
        ScheduledFuture<?> future = scheduledTasks.remove(suiteId);
        if (future != null) {
            future.cancel(false);
            log.info("Cancelled scheduled execution for suite ID: {}", suiteId);
        }
    }
}
