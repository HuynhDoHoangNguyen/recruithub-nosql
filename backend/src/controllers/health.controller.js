export function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: 'RecruiHub Backend is running'
  });
}
