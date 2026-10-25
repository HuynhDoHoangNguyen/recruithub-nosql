export function scoringController(scoringService) {
  return {
    compute: async (req, res) => {
      const result = await scoringService.analyzeApplicationForRecruiter(
        req.user,
        req.validated.body.application_id
      );
      res.status(200).json({
        success: true,
        data: result,
        message: 'Đã phân tích mức độ phù hợp hồ sơ.',
      });
    },
    getAnalysis: async (req, res) => {
      const applicationId = req.validated?.params?.applicationId || req.params.applicationId;
      const result = await scoringService.getResumeAnalysisForRecruiter(
        req.user,
        applicationId
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    },
  };
}
