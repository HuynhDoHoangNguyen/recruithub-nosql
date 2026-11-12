export function candidateRankingController(rankingService) {
  return {
    list: async (req, res) => {
      const result = await rankingService.getRankingForRecruiter(
        req.user,
        req.validated.params.id,
        req.validated.query
      );
      res.status(200).json({
        success: true,
        data: result,
        message: 'Đã tải bảng xếp hạng ứng viên.',
      });
    },
  };
}
