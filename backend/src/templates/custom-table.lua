-- custom-table.lua
-- Pandoc Lua filter for custom table styling with borders and centered header

-- 处理 Pandoc 3.x 的表格格式
-- 添加边框和灰色表头背景
function Table(el)
  -- 检查表格是否有 header
  if el.head and #el.head.rows > 0 then
    -- 为表头行添加灰色背景样式
    for _, row in ipairs(el.head.rows) do
      for _, cell in ipairs(row.cells) do
        -- 设置单元格样式属性
        cell.attr = pandoc.Attr('', {}, {
          shading = {fill = 'D9D9D9'},  -- 灰色背景
          bold = true                   -- 表头加粗
        })
      end
    end
  end

  -- 表格居中 - 设置对齐方式
  el.attr = pandoc.Attr('', {}, {
    alignment = 'center'
  })

  return el
end

return {{Table = Table}}