require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "OppenheimerAppInfo"
  s.version      = package["version"]
  s.summary      = "Sample Oppenheimer Nitro module"
  s.homepage     = "https://github.com/jordiparracrespo/oppenheimer"
  s.license      = "MIT"
  s.authors      = "Oppenheimer"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/jordiparracrespo/oppenheimer.git", :tag => "#{s.version}" }
  s.source_files = [
    "ios/**/*.{h,m,mm,swift}",
    "cpp/**/*.{hpp,cpp}",
  ]
  load "nitrogen/generated/ios/OppenheimerAppInfo+autolinking.rb"
  add_nitrogen_files(s)
end
