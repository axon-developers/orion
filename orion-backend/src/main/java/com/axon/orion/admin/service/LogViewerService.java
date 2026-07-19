package com.axon.orion.admin.service;

import com.axon.orion.admin.dto.AdminDtos;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class LogViewerService {

    private static final String LOG_DIR = "logs";
    private static final String ACTIVE_LOG = "logs/orion.log";
    
    // Pattern to match standard Logback log lines: 
    // 2026-07-11 12:44:10.123 [main] INFO  c.a.o.OrionApplication - Started OrionApplication...
    private static final Pattern LOG_LINE_PATTERN = Pattern.compile(
            "^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+\\[([^\\]]+)\\]\\s+([A-Z]{4,5})\\s+([^\\s]+)\\s+-\\s+(.*)$"
    );

    public List<AdminDtos.LogEntryDto> getLogs(int daysScope, String levelFilter, String searchFilter) {
        List<File> logFiles = collectLogFiles(daysScope);
        List<AdminDtos.LogEntryDto> entries = new ArrayList<>();
        
        for (File file : logFiles) {
            parseLogFile(file, entries);
        }

        // Apply filters
        List<AdminDtos.LogEntryDto> filtered = entries.stream()
                .filter(entry -> {
                    if (levelFilter != null && !levelFilter.isEmpty() && !"ALL".equalsIgnoreCase(levelFilter)) {
                        return entry.getLevel().equalsIgnoreCase(levelFilter.trim());
                    }
                    return true;
                })
                .filter(entry -> {
                    if (searchFilter != null && !searchFilter.isEmpty()) {
                        String query = searchFilter.toLowerCase();
                        return entry.getRawLine().toLowerCase().contains(query);
                    }
                    return true;
                })
                .collect(Collectors.toList());

        // Sort chronologically (oldest to newest)
        filtered.sort(Comparator.comparing(AdminDtos.LogEntryDto::getTimestamp));

        // Limit results to last 1000 lines to protect memory heap
        if (filtered.size() > 1000) {
            return filtered.subList(filtered.size() - 1000, filtered.size());
        }
        return filtered;
    }

    public String exportRawLogs(int daysScope, String levelFilter, String searchFilter) {
        List<AdminDtos.LogEntryDto> entries = getLogs(daysScope, levelFilter, searchFilter);
        StringBuilder sb = new StringBuilder();
        for (AdminDtos.LogEntryDto entry : entries) {
            sb.append(entry.getRawLine()).append("\n");
        }
        return sb.toString();
    }

    private List<File> collectLogFiles(int daysScope) {
        List<File> files = new ArrayList<>();
        
        // Always add the active log file if it exists
        File active = new File(ACTIVE_LOG);
        if (active.exists()) {
            files.add(active);
        }

        if (daysScope > 1) {
            // Collect older rolled-over log files from the last N days
            LocalDate today = LocalDate.now();
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            
            for (int i = 1; i < daysScope; i++) {
                LocalDate date = today.minusDays(i);
                String fileName = String.format("orion.%s.log", date.format(formatter));
                File historicalFile = new File(LOG_DIR, fileName);
                if (historicalFile.exists()) {
                    files.add(historicalFile);
                }
            }
        }

        // Sort files by last modified to process older files first
        files.sort(Comparator.comparingLong(File::lastModified));
        return files;
    }

    private void parseLogFile(File file, List<AdminDtos.LogEntryDto> entries) {
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            AdminDtos.LogEntryDto currentEntry = null;
            
            while ((line = reader.readLine()) != null) {
                Matcher matcher = LOG_LINE_PATTERN.matcher(line);
                
                if (matcher.matches()) {
                    currentEntry = new AdminDtos.LogEntryDto();
                    currentEntry.setTimestamp(matcher.group(1));
                    currentEntry.setThread(matcher.group(2));
                    currentEntry.setLevel(matcher.group(3).trim());
                    currentEntry.setLogger(matcher.group(4));
                    currentEntry.setMessage(matcher.group(5));
                    currentEntry.setRawLine(line);
                    entries.add(currentEntry);
                } else {
                    // Continuation of stack traces/exceptions
                    if (currentEntry != null) {
                        currentEntry.setMessage(currentEntry.getMessage() + "\n" + line);
                        currentEntry.setRawLine(currentEntry.getRawLine() + "\n" + line);
                    }
                }
            }
        } catch (IOException e) {
            log.error("Failed to read log file {}: {}", file.getName(), e.getMessage());
        }
    }
}
