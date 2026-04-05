Write-Host "Building and starting Docker services..." -ForegroundColor Cyan
Write-Host "(Frontend will build inside Docker container)" -ForegroundColor Gray
docker-compose up --build -d

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Services started successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API: http://localhost:5000" -ForegroundColor Yellow
Write-Host "API Docs: http://localhost:5000/docs" -ForegroundColor Yellow
Write-Host "MySQL: localhost:3306" -ForegroundColor Yellow
Write-Host ""
Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Cyan
Write-Host "To stop: docker-compose down" -ForegroundColor Cyan
