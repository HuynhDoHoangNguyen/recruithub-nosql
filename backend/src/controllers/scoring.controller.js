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
  };
}
