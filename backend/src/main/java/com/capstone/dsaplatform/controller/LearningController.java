package com.capstone.dsaplatform.controller;

import com.capstone.dsaplatform.dto.LearningDtos.ActivityResponse;
import com.capstone.dsaplatform.dto.LearningDtos.ModelInfo;
import com.capstone.dsaplatform.dto.LearningDtos.ProblemStatusView;
import com.capstone.dsaplatform.dto.LearningDtos.ReviewResponse;
import com.capstone.dsaplatform.dto.LearningDtos.StudyPlanView;
import com.capstone.dsaplatform.service.LearningService;
import com.capstone.dsaplatform.service.StudyPlanService;
import com.capstone.dsaplatform.service.TrainingExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Review queue, activity, problem status, study plans, and the ML model's info and training export. */
@RestController
public class LearningController {

    private final LearningService learningService;
    private final StudyPlanService studyPlanService;
    private final TrainingExportService trainingExport;

    public LearningController(LearningService learningService, StudyPlanService studyPlanService,
                              TrainingExportService trainingExport) {
        this.learningService = learningService;
        this.studyPlanService = studyPlanService;
        this.trainingExport = trainingExport;
    }

    @GetMapping("/api/users/{id}/review")
    public ReviewResponse review(@PathVariable Long id, @RequestParam(defaultValue = "3") int horizonDays) {
        return learningService.review(id, horizonDays);
    }

    @GetMapping("/api/users/{id}/activity")
    public ActivityResponse activity(@PathVariable Long id, @RequestParam(defaultValue = "182") int days) {
        return learningService.activity(id, days);
    }

    @GetMapping("/api/users/{id}/problem-status")
    public List<ProblemStatusView> problemStatus(@PathVariable Long id) {
        return learningService.problemStatus(id);
    }

    @GetMapping("/api/study-plans")
    public List<StudyPlanView> studyPlans(@RequestParam Long userId) {
        return studyPlanService.plans(userId);
    }

    @GetMapping("/api/ml/model")
    public ModelInfo model() {
        return learningService.modelInfo();
    }

    @GetMapping(value = "/api/ml/training-data", produces = "text/csv")
    public ResponseEntity<String> trainingData() {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"hlr_training_data.csv\"")
                .body(trainingExport.csv());
    }
}
